// tests/test-server.js - Servidor configurado para testes
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { body } = require('express-validator');
const session = require('express-session');

// Importar middleware de segurança
const {
    sanitizeMiddleware,
    handleValidationErrors,
    authenticateToken,
    validators,
    bodySizeLimit
} = require('../middleware.js');

// Importar banco de dados de teste
const { getTestDb, dbGet, dbAll, dbRun } = require('./database-test');

// Função para criar servidor de teste
const createTestServer = () => {
    const app = express();

    // Configurações de segurança - Helmet (menos restritivo para testes)
    app.use(helmet({
        contentSecurityPolicy: false, // Desabilitar CSP para testes
        hsts: false // Desabilitar HSTS para testes
    }));

    // Configuração CORS mais permissiva para testes
    app.use(cors({
        origin: function (origin, callback) {
            // Permitir todas as origens em testes
            callback(null, true);
        },
        credentials: true,
        optionsSuccessStatus: 200
    }));

    // Configuração de sessão em memória para testes
    app.use(session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: false, // HTTP em testes
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000 // 24 horas
        }
    }));

    // Middleware para parsing e sanitização com tratamento de erro
    app.use(express.json({ 
        limit: '10mb',
        verify: (req, res, buf, encoding) => {
            try {
                JSON.parse(buf);
            } catch (err) {
                const error = new Error('JSON malformado');
                error.status = 400;
                throw error;
            }
        }
    }));
    app.use(bodySizeLimit('10mb'));
    app.use(sanitizeMiddleware);

    // Rate limiting mais permissivo para testes, mas ainda testável
    const globalLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutos
        max: 1000, // Muito permissivo para testes normais
        message: { error: 'Muitas requisições. Por favor, tente novamente mais tarde.' },
        standardHeaders: true,
        legacyHeaders: false,
        skip: (req) => process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit']
    });
    app.use(globalLimiter);

    // Rate limiting específico para login (mais restritivo para testar)
    const loginLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 5,
        message: { error: 'Muitas tentativas de login. Por favor, tente novamente em 15 minutos.' },
        skipSuccessfulRequests: true,
        skip: (req) => process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit']
    });

    // --- ROTAS DE AUTENTICAÇÃO ---

    // Rota para registrar um novo usuário
    app.post('/register', 
        validators.email,
        validators.password,
        handleValidationErrors,
        async (req, res) => {
            const { email, password } = req.body;
            try {
                const hashedPassword = await bcrypt.hash(password, 12);
                await dbRun('INSERT INTO users (email, password_hash) VALUES (?,?)', [email, hashedPassword]);
                res.status(201).json({ "message": "Usuário criado com sucesso!" });
            } catch (error) {
                if (error.message.includes('UNIQUE constraint failed')) {
                    res.status(400).json({ error: "Este e-mail já está em uso." });
                } else {
                    console.error('Erro no registro:', error);
                    res.status(500).json({ error: "Erro ao criar usuário." });
                }
            }
        }
    );

    // Rota para login de usuário
    app.post('/login', 
        loginLimiter,
        validators.email,
        validators.password,
        handleValidationErrors,
        async (req, res) => {
            const { email, password } = req.body;
            try {
                const user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
                if (!user || !await bcrypt.compare(password, user.password_hash)) {
                    return res.status(401).json({ "error": "E-mail ou senha inválidos." });
                }
                
                // Gerar token com informações mínimas e expiração
                const token = jwt.sign(
                    { id: user.id, email: user.email }, 
                    process.env.JWT_SECRET, 
                    { expiresIn: '24h', issuer: 'editaliza' }
                );
                
                // Salvar informações da sessão
                req.session.userId = user.id;
                req.session.loginTime = new Date();
                
                res.json({ "message": "Login bem-sucedido!", "token": token });
            } catch (error) {
                console.error('Erro no login:', error);
                res.status(500).json({ "error": "Erro no servidor." });
            }
        }
    );

    // Rota para logout
    app.post('/logout', authenticateToken, (req, res) => {
        req.session.destroy((err) => {
            if (err) {
                return res.status(500).json({ error: 'Erro ao fazer logout' });
            }
            res.json({ message: 'Logout realizado com sucesso' });
        });
    });

    // Rota para solicitar redefinição de senha
    app.post('/request-password-reset',
        validators.email,
        handleValidationErrors,
        async (req, res) => {
            const { email } = req.body;
            try {
                const user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
                if (user) {
                    const token = crypto.randomBytes(32).toString('hex');
                    const expires = Date.now() + 3600000; // 1 hora
                    await dbRun('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?', [token, expires, user.id]);
                    // Em testes, não enviamos e-mail real
                    console.log(`TESTE: Link de recuperação para ${user.email}: http://localhost:3000/reset-password.html?token=${token}`);
                }
                // Resposta genérica para evitar enumeração de usuários
                res.json({ message: "Se um usuário com este e-mail existir, um link de recuperação foi enviado." });
            } catch (error) {
                console.error('Erro na recuperação de senha:', error);
                res.status(500).json({ "error": "Erro no servidor ao processar a solicitação." });
            }
        }
    );

    // Rota para redefinir a senha com um token
    app.post('/reset-password',
        body('token').isLength({ min: 32, max: 64 }).withMessage('Token inválido'),
        validators.password,
        handleValidationErrors,
        async (req, res) => {
            const { token, password } = req.body;
            try {
                const user = await dbGet('SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > ?', [token, Date.now()]);
                if (!user) {
                    return res.status(400).json({ error: "Token inválido ou expirado." });
                }
                const hashedPassword = await bcrypt.hash(password, 12);
                await dbRun('UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?', [hashedPassword, user.id]);
                res.json({ message: "Senha redefinida com sucesso!" });
            } catch (error) {
                console.error('Erro ao redefinir senha:', error);
                res.status(500).json({ "error": "Erro no servidor ao redefinir a senha." });
            }
        }
    );

    // Rota de teste para verificar autenticação
    app.get('/protected', authenticateToken, (req, res) => {
        res.json({ 
            message: 'Acesso autorizado', 
            user: { id: req.user.id, email: req.user.email } 
        });
    });

    // Rota de healthcheck para testes
    app.get('/health', (req, res) => {
        res.json({ status: 'ok', database: !!getTestDb() });
    });

    // Tratamento de erros global
    app.use((err, req, res, next) => {
        if (err.message === 'Not allowed by CORS') {
            return res.status(403).json({ error: 'Origem não permitida' });
        }
        
        // Tratar erros de JSON malformado
        if (err.type === 'entity.parse.failed') {
            return res.status(400).json({ error: 'JSON malformado' });
        }
        
        // Tratar erros personalizados com status
        if (err.status) {
            return res.status(err.status).json({ error: err.message });
        }
        
        console.error('Erro não tratado:', err);
        res.status(500).json({ error: 'Erro interno do servidor' });
    });

    return app;
};

module.exports = { createTestServer };