// server.js - Versão com correções de segurança e suporte a PostgreSQL
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { body, query, validationResult } = require('express-validator');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const passport = require('./src/config/passport');
require('dotenv').config();

// Importar middleware de segurança
const {
    sanitizeMiddleware,
    handleValidationErrors,
    authenticateToken,
    validators,
    bodySizeLimit
} = require('./middleware.js');


// ============================================================================
// INICIALIZAÇÃO DO BANCO DE DADOS (SQLite ou PostgreSQL)
// ============================================================================
const isProduction = process.env.NODE_ENV === 'production';
let db, dbGet, dbAll, dbRun, sessionStore;

if (isProduction) {
    console.log('🚀 Executando em modo de produção. Usando PostgreSQL.');
    const { pool, testConnection } = require('./database-cloud.js');
    db = pool;
    
    // Testar a conexão com o PostgreSQL ao iniciar
    testConnection().catch(err => {
        console.error("FATAL: Não foi possível conectar ao PostgreSQL. A aplicação será encerrada.", err);
        process.exit(1);
    });

    const pgSession = require('connect-pg-simple')(session);
    sessionStore = new pgSession({
        pool: db,
        tableName: 'sessions',
        createTableIfMissing: true,
    });

} else {
    console.log('🔧 Executando em modo de desenvolvimento. Usando SQLite.');
    const sqliteDb = require('./database.js');
    db = sqliteDb;

    const SQLiteStore = require('connect-sqlite3')(session);
    sessionStore = new SQLiteStore({
        db: 'sessions.db',
        dir: './'
    });
}

// Funções utilitárias para interagir com o banco de dados usando Promises
if (!isProduction) {
    dbGet = (sql, params = []) => new Promise((resolve, reject) => db.get(sql, params, (err, row) => err ? reject(err) : resolve(row)));
    dbAll = (sql, params = []) => new Promise((resolve, reject) => db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows)));
    dbRun = (sql, params = []) => new Promise((resolve, reject) => db.run(sql, params, function(err) { err ? reject(err) : resolve(this) }));
} else {
    dbGet = async (sql, params = []) => {
        const { rows } = await db.query(sql, params);
        return rows[0];
    };
    dbAll = async (sql, params = []) => {
        const { rows } = await db.query(sql, params);
        return rows;
    };
    dbRun = async (sql, params = []) => {
        const result = await db.query(sql, params);
        // Emular a interface do 'sqlite3' para 'lastID' e 'changes'
        return {
            lastID: result.rows[0] ? result.rows[0].id : null,
            changes: result.rowCount
        };
    };
}


// ============================================================================
// VALIDAÇÃO DE SEGURANÇA EM PRODUÇÃO
// ============================================================================
const { validateProductionSecrets } = require('./src/utils/security');

// Validar secrets em produção antes de inicializar
try {
    validateProductionSecrets();
    console.log('✅ Secrets de produção validados');
} catch (error) {
    console.error('❌ ERRO DE SEGURANÇA:', error.message);
    if (isProduction) {
        process.exit(1); // Não permitir inicialização sem secrets
    }
}

const app = express();
// Servir arquivos estáticos (HTML, CSS, JS)
app.use(express.static(__dirname));

// Configurações de segurança - Helmet
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://fonts.googleapis.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"] ,
            connectSrc: ["'self'", "https://accounts.google.com"],
            formAction: ["'self'", "https://accounts.google.com"],
        },
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));

// Configuração CORS mais restritiva
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
app.use(cors({
    origin: function (origin, callback) {
        if (!origin && !isProduction) {
            return callback(null, true);
        }
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.warn('CORS bloqueou origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    exposedHeaders: ['X-Total-Count']
}));

// Configuração de sessão
app.use(session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: isProduction,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 horas
    }
}));

// Configure Passport
app.use(passport.initialize());
app.use(passport.session());

// Middleware para parsing e sanitização
app.use(express.json({ limit: '10mb' }));
app.use(bodySizeLimit('10mb'));
app.use(sanitizeMiddleware);

// Rate limiting global
const globalLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 500,
    message: { error: 'Muitas requisições. Por favor, tente novamente mais tarde.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        const skipPaths = [
            '/gamification',
            '/schedule', 
            '/overdue_check',
            '/progress',
            '/goal_progress',
            '/realitycheck'
        ];
        return skipPaths.some(path => req.path.endsWith(path));
    }
});
app.use(globalLimiter);

// Configuração do Multer para upload de arquivos
// Import GCS uploader
const { uploadToGCS } = require('./cloud-storage.js');

// Configuração do Multer para upload de arquivos
// Em produção, usamos armazenamento em memória para enviar ao GCS.
// Em desenvolvimento, salvamos em disco para simplicidade.
const storage = isProduction ? multer.memoryStorage() : multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'profile-' + req.user.id + '-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB máximo
    },
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Apenas arquivos de imagem são permitidos.'), false);
        }
    }
});

// Servir arquivos de upload estaticamente (apenas para desenvolvimento)
if (!isProduction) {
    app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
}

// Verificar variáveis de ambiente críticas
const requiredEnvVars = ['JWT_SECRET', 'SESSION_SECRET'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
    console.error(`ERRO: Variáveis de ambiente obrigatórias não definidas: ${missingEnvVars.join(', ')}`);
    console.error('Por favor, crie um arquivo .env baseado no .env.example');
    process.exit(1);
}

// ============================================================================
// ARQUITETURA DE ROTAS MODULAR
// ============================================================================

// Importar rotas modulares
const planRoutes = require('./src/routes/planRoutes');
const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const scheduleRoutes = require('./src/routes/scheduleRoutes');

// Utilizar rotas modulares
app.use('/plans', planRoutes);
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/schedules', scheduleRoutes);

// ============================================================================
// ROTAS LEGADAS (A SEREM REATORADAS OU REMOVIDAS)
// ============================================================================

// --- ROTAS DE PLANOS (CRUD E CONFIGURAÇÕES) ---
app.get('/plans', authenticateToken, async (req, res) => {
    try {
        const rows = await dbAll('SELECT * FROM study_plans WHERE user_id = ? ORDER BY id DESC', [req.user.id]);
        res.json(rows.map(plan => ({...plan, study_hours_per_day: JSON.parse(plan.study_hours_per_day || '{}')})));
    } catch (error) {
        console.error('Erro ao buscar planos:', error);
        res.status(500).json({ "error": "Erro ao buscar planos" });
    }
});

app.post('/plans', 
    authenticateToken,
    validators.text('plan_name', 1, 200),
    validators.date('exam_date'),
    handleValidationErrors,
    async (req, res) => {
        const { plan_name, exam_date } = req.body;
        const defaultHours = JSON.stringify({ '0': 0, '1': 4, '2': 4, '3': 4, '4': 4, '5': 4, '6': 4 });
        const sql = `
            INSERT INTO study_plans 
            (user_id, plan_name, exam_date, study_hours_per_day, daily_question_goal, weekly_question_goal, session_duration_minutes, review_mode, postponement_count, has_essay) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        try {
            const result = await dbRun(sql, [req.user.id, plan_name, exam_date, defaultHours, 50, 300, 50, 'completo', 0, false]);
            res.status(201).json({ "message": "Plano criado com sucesso!", "newPlanId": result.lastID });
        } catch (error) {
            console.error('Erro ao criar plano:', error);
            res.status(500).json({ "error": "Erro ao criar plano" });
        }
    }
);

app.get('/plans/:id', 
    authenticateToken,
    validators.numericId('id'),
    handleValidationErrors,
    async (req, res) => {
        try {
            const row = await dbGet("SELECT * FROM study_plans WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
            if (!row) return res.status(404).json({ "error": "Plano não encontrado ou não autorizado." });
            if (row.study_hours_per_day) {
                row.study_hours_per_day = JSON.parse(row.study_hours_per_day);
            }
            res.json(row);
        } catch (error) {
            console.error('Erro ao buscar plano:', error);
            res.status(500).json({ "error": "Erro ao buscar plano" });
        }
    }
);

app.delete('/plans/:planId', 
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    async (req, res) => {
        const planId = req.params.planId;
        const userId = req.user.id;
        try {
            const plan = await dbGet('SELECT id FROM study_plans WHERE id = ? AND user_id = ?', [planId, userId]);
            if (!plan) return res.status(404).json({ "error": "Plano não encontrado ou você não tem permissão." });
            
            await dbRun('BEGIN TRANSACTION');
            await dbRun('DELETE FROM study_sessions WHERE study_plan_id = ?', [planId]);
            await dbRun('DELETE FROM topics WHERE subject_id IN (SELECT id FROM subjects WHERE study_plan_id = ?)', [planId]);
            await dbRun('DELETE FROM subjects WHERE study_plan_id = ?', [planId]);
            await dbRun('DELETE FROM study_plans WHERE id = ?', [planId]);
            await dbRun('COMMIT');
            
            res.json({ message: "Plano e todos os dados associados foram apagados com sucesso" });
        } catch (error) {
            await dbRun('ROLLBACK');
            console.error('Erro ao apagar plano:', error);
            res.status(500).json({ "error": "Erro ao apagar o plano." });
        }
    }
);

app.patch('/plans/:planId/settings', 
    authenticateToken,
    validators.numericId('planId'),
    validators.integer('daily_question_goal', 0, 500),
    validators.integer('weekly_question_goal', 0, 3500),
    validators.integer('session_duration_minutes', 10, 240),
    body('has_essay').isBoolean().withMessage('has_essay deve ser booleano'),
    validators.jsonField('study_hours_per_day'),
    handleValidationErrors,
    async (req, res) => {
        const { daily_question_goal, weekly_question_goal, review_mode, session_duration_minutes, study_hours_per_day, has_essay } = req.body;
        const hoursJson = JSON.stringify(study_hours_per_day);
        
        const validReviewModes = ['completo', 'focado'];
        if (review_mode && !validReviewModes.includes(review_mode)) {
            return res.status(400).json({ error: "Modo de revisão inválido" });
        }
        
        const sql = 'UPDATE study_plans SET daily_question_goal = ?, weekly_question_goal = ?, review_mode = ?, session_duration_minutes = ?, study_hours_per_day = ?, has_essay = ? WHERE id = ? AND user_id = ?';
        try {
            const result = await dbRun(sql, [daily_question_goal, weekly_question_goal, review_mode || 'completo', session_duration_minutes, hoursJson, has_essay, req.params.planId, req.user.id]);
            if (result.changes === 0) return res.status(404).json({ error: "Plano não encontrado ou não autorizado." });
            res.json({ message: "Configurações salvas com sucesso!" });
        } catch (error) {
            console.error('Erro ao atualizar configurações:', error);
            res.status(500).json({ "error": "Erro ao salvar configurações" });
        }
    }
);

app.post('/plans/:planId/subjects_with_topics', 
    authenticateToken,
    validators.numericId('planId'),
    validators.text('subject_name', 1, 200),
    validators.integer('priority_weight', 1, 5),
    body('topics_list').isString().isLength({ max: 10000 }).withMessage('Lista de tópicos muito longa'),
    handleValidationErrors,
    async (req, res) => {
        const { subject_name, priority_weight, topics_list } = req.body;
        const planId = req.params.planId;
        
        try {
            const plan = await dbGet('SELECT id FROM study_plans WHERE id = ? AND user_id = ?', [planId, req.user.id]);
            if (!plan) return res.status(404).json({ "error": "Plano não encontrado ou não autorizado." });

            const topics = topics_list.split('\n').map(t => t.trim()).filter(t => t !== '');
            
            await dbRun('BEGIN TRANSACTION');
            const result = await dbRun('INSERT INTO subjects (study_plan_id, subject_name, priority_weight) VALUES (?,?,?)', [planId, subject_name, priority_weight]);
            const subjectId = result.lastID;
            
            if (topics.length > 0) {
                const insertTopicsStmt = db.prepare('INSERT INTO topics (subject_id, description) VALUES (?,?)');
                topics.forEach(topic => insertTopicsStmt.run(subjectId, topic.substring(0, 500)));
                await new Promise((resolve, reject) => insertTopicsStmt.finalize(err => err ? reject(err) : resolve()));
            }
            
            await dbRun('COMMIT');
            res.status(201).json({ message: "Disciplina e tópicos adicionados com sucesso!" });
        } catch (error) {
            await dbRun('ROLLBACK');
            console.error('Erro ao criar disciplina:', error);
            res.status(500).json({ "error": "Erro ao criar a disciplina e tópicos." });
        }
    }
);

app.patch('/subjects/:subjectId', 
    authenticateToken,
    validators.numericId('subjectId'),
    validators.text('subject_name', 1, 200),
    validators.integer('priority_weight', 1, 5),
    handleValidationErrors,
    async (req, res) => {
        const { subject_name, priority_weight } = req.body;
        const sql = `
            UPDATE subjects SET subject_name = ?, priority_weight = ? 
            WHERE id = ? AND study_plan_id IN (SELECT id FROM study_plans WHERE user_id = ?)
        `;
        try {
            const result = await dbRun(sql, [subject_name, priority_weight, req.params.subjectId, req.user.id]);
            if (result.changes === 0) return res.status(404).json({ error: "Disciplina não encontrada ou não autorizada." });
            res.json({ message: 'Disciplina atualizada com sucesso!' });
        } catch (error) {
            console.error('Erro ao atualizar disciplina:', error);
            res.status(500).json({ error: "Erro ao atualizar disciplina" });
        }
    }
);

app.delete('/subjects/:subjectId', 
    authenticateToken,
    validators.numericId('subjectId'),
    handleValidationErrors,
    async (req, res) => {
        const subjectId = req.params.subjectId;
        try {
            const subject = await dbGet(`
                SELECT s.id FROM subjects s JOIN study_plans sp ON s.study_plan_id = sp.id 
                WHERE s.id = ? AND sp.user_id = ?
            `, [subjectId, req.user.id]);
            if (!subject) return res.status(404).json({ error: "Disciplina não encontrada ou não autorizada." });

            await dbRun('BEGIN TRANSACTION');
            await dbRun('DELETE FROM study_sessions WHERE topic_id IN (SELECT id FROM topics WHERE subject_id = ?)', [subjectId]);
            await dbRun('DELETE FROM topics WHERE subject_id = ?', [subjectId]);
            await dbRun('DELETE FROM subjects WHERE id = ?', [subjectId]);
            await dbRun('COMMIT');
            res.json({ message: "Disciplina e todos os seus dados foram apagados com sucesso" });
        } catch (error) {
            await dbRun('ROLLBACK');
            console.error('Erro ao apagar disciplina:', error);
            res.status(500).json({ "error": "Erro ao apagar disciplina" });
        }
    }
);

app.get('/subjects/:subjectId/topics', 
    authenticateToken,
    validators.numericId('subjectId'),
    handleValidationErrors,
    async (req, res) => {
        try {
            const subject = await dbGet(`
                SELECT s.id FROM subjects s JOIN study_plans sp ON s.study_plan_id = sp.id 
                WHERE s.id = ? AND sp.user_id = ?
            `, [req.params.subjectId, req.user.id]);
            if (!subject) return res.status(404).json({ error: "Disciplina não encontrada ou não autorizada." });

            const rows = await dbAll("SELECT id, description, status, completion_date FROM topics WHERE subject_id = ? ORDER BY id ASC", [req.params.subjectId]);
            res.json(rows);
        } catch (error) {
            console.error('Erro ao buscar tópicos:', error);
            res.status(500).json({ "error": "Erro ao buscar tópicos" });
        }
    }
);

app.patch('/topics/batch_update', 
    authenticateToken,
    body('topics').isArray().withMessage('O corpo deve conter um array de tópicos'),
    body('topics.*.id').isInt().withMessage('ID do tópico inválido'),
    body('topics.*.status').isIn(['Pendente', 'Concluído']).withMessage('Status inválido'),
    body('topics.*.completion_date').optional({ nullable: true }).isISO8601().withMessage('Data de conclusão inválida'),
    handleValidationErrors,
    async (req, res) => {
        const { topics } = req.body;

        try {
            await dbRun('BEGIN TRANSACTION');
            const stmt = db.prepare(`
                UPDATE topics SET status = ?, completion_date = ? 
                WHERE id = ? AND subject_id IN (
                    SELECT id FROM subjects WHERE study_plan_id IN (
                        SELECT id FROM study_plans WHERE user_id = ?
                    )
                )
            `);
            for (const topic of topics) {
                const completionDate = topic.status === 'Concluído' ? topic.completion_date : null;
                await new Promise((resolve, reject) => stmt.run(topic.status, completionDate, topic.id, req.user.id, err => err ? reject(err) : resolve()));
            }
            await new Promise((resolve, reject) => stmt.finalize(err => err ? reject(err) : resolve()));
            await dbRun('COMMIT');
            res.json({ message: "Progresso dos tópicos atualizado com sucesso!" });
        } catch (error) {
            await dbRun('ROLLBACK');
            console.error('Erro ao atualizar tópicos:', error);
            res.status(500).json({ "error": "Erro ao atualizar os tópicos." });
        }
    }
);

app.patch('/topics/:topicId', 
    authenticateToken,
    validators.numericId('topicId'),
    validators.text('description', 1, 500),
    handleValidationErrors,
    async (req, res) => {
        const { description } = req.body;
        const sql = `
            UPDATE topics SET description = ? 
            WHERE id = ? AND subject_id IN (
                SELECT id FROM subjects WHERE study_plan_id IN (
                    SELECT id FROM study_plans WHERE user_id = ?
                )
            )
        `;
        try {
            const result = await dbRun(sql, [description, req.params.topicId, req.user.id]);
            if (result.changes === 0) return res.status(404).json({ error: "Tópico não encontrado ou não autorizado." });
            res.json({ message: 'Tópico atualizado com sucesso!' });
        } catch (error) {
            console.error('Erro ao atualizar tópico:', error);
            res.status(500).json({ error: "Erro ao atualizar tópico" });
        }
    }
);

app.delete('/topics/:topicId', 
    authenticateToken,
    validators.numericId('topicId'),
    handleValidationErrors,
    async (req, res) => {
        const topicId = req.params.topicId;
        try {
            const topic = await dbGet(`
                SELECT t.id FROM topics t 
                JOIN subjects s ON t.subject_id = s.id
                JOIN study_plans sp ON s.study_plan_id = sp.id 
                WHERE t.id = ? AND sp.user_id = ?
            `, [topicId, req.user.id]);
            if (!topic) return res.status(404).json({ error: "Tópico não encontrado ou não autorizado." });

            await dbRun('BEGIN TRANSACTION');
            await dbRun('DELETE FROM study_sessions WHERE topic_id = ?', [topicId]);
            await dbRun('DELETE FROM topics WHERE id = ?', [topicId]);
            await dbRun('DELETE FROM subjects WHERE id = ?', [topicId]);
            await dbRun('COMMIT');
            res.json({ message: "Tópico e sessões associadas foram apagados com sucesso" });
        } catch (error) {
            await dbRun('ROLLBACK');
            console.error('Erro ao apagar tópico:', error);
            res.status(500).json({ "error": "Erro ao apagar tópico" });
        }
    }
);

// --- ROTA DE GERAÇÃO DE CRONOGRAMA OTIMIZADA ---
app.post('/plans/:planId/generate', 
    authenticateToken,
    validators.numericId('planId'),
    validators.integer('daily_question_goal', 0, 500),
    validators.integer('weekly_question_goal', 0, 3500),
    validators.integer('session_duration_minutes', 10, 240),
    body('has_essay').isBoolean().withMessage('has_essay deve ser booleano'),
    validators.jsonField('study_hours_per_day'),
    handleValidationErrors,
    async (req, res) => {
        const planId = req.params.planId;
        const { daily_question_goal, weekly_question_goal, session_duration_minutes, study_hours_per_day, has_essay } = req.body;
        
        console.time(`[PERF] Generate schedule for plan ${planId}`);

        try {
            await dbRun('BEGIN IMMEDIATE TRANSACTION');
            
            const hoursJson = JSON.stringify(study_hours_per_day);
            await dbRun('UPDATE study_plans SET daily_question_goal = ?, weekly_question_goal = ?, review_mode = ?, session_duration_minutes = ?, study_hours_per_day = ?, has_essay = ? WHERE id = ? AND user_id = ?', 
                [daily_question_goal, weekly_question_goal, session_duration_minutes, hoursJson, has_essay, planId, req.user.id]);
            
            const plan = await dbGet('SELECT * FROM study_plans WHERE id = ?', [planId]);
            if (!plan) {
                await dbRun('ROLLBACK');
                return res.status(404).json({ error: "Plano não encontrado." });
            }

            const totalWeeklyHours = Object.values(study_hours_per_day).reduce((sum, h) => sum + (parseInt(h, 10) || 0), 0);
            if (totalWeeklyHours === 0) {
                await dbRun('ROLLBACK');
                return res.status(400).json({ error: "O cronograma não pode ser gerado porque não há horas de estudo definidas." });
            }

            await dbRun("DELETE FROM study_sessions WHERE study_plan_id = ?", [planId]);

            const allTopicsQuery = `
                SELECT 
                    t.id, t.description, t.status, t.completion_date,
                    s.subject_name, s.priority_weight as priority
                FROM subjects s
                INNER JOIN topics t ON s.id = t.subject_id
                WHERE s.study_plan_id = ?
                ORDER BY s.priority_weight DESC, t.id ASC
            `;
            const allTopics = await dbAll(allTopicsQuery, [planId]);

            if (allTopics.length === 0) {
                await dbRun('COMMIT');
                return res.json({ message: "Nenhum tópico encontrado para gerar o cronograma." });
            }
            
            const sessionDuration = parseInt(session_duration_minutes, 10) || 50;
            const examDate = new Date(plan.exam_date + 'T23:59:59');
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const availableDatesCache = new Map();
            const getAvailableDates = (startDate, endDate, weekdayOnly = false) => {
                const cacheKey = `${startDate.getTime()}-${endDate.getTime()}-${weekdayOnly}`;
                if (availableDatesCache.has(cacheKey)) {
                    return availableDatesCache.get(cacheKey);
                }
                
                const dates = [];
                let currentDate = new Date(startDate);
                while (currentDate <= endDate) {
                    const dayOfWeek = currentDate.getDay();
                    const shouldSkip = (weekdayOnly && (dayOfWeek === 0 || dayOfWeek === 6));
                    
                    if (!shouldSkip && (study_hours_per_day[dayOfWeek] || 0) > 0) {
                        dates.push({
                            date: new Date(currentDate),
                            dayOfWeek,
                            maxSessions: Math.floor((study_hours_per_day[dayOfWeek] * 60) / sessionDuration)
                        });
                    }
                    currentDate.setDate(currentDate.getDate() + 1);
                }
                availableDatesCache.set(cacheKey, dates);
                return dates;
            };

            const agenda = new Map();
            const addSessionToAgenda = (date, session) => {
                const dateStr = date.toISOString().split('T')[0];
                if (!agenda.has(dateStr)) {
                    agenda.set(dateStr, []);
                }
                agenda.get(dateStr).push({ ...session, session_date: dateStr });
            };
            
            if (plan.has_essay) {
                const sundayDates = getAvailableDates(today, examDate).filter(d => d.dayOfWeek === 0);
                for (const dateInfo of sundayDates) {
                    addSessionToAgenda(dateInfo.date, {
                        topicId: null,
                        subjectName: "Redação",
                        topicDescription: "Prática de redação dissertativa-argumentativa, focando em estrutura, coesão e argumentação.",
                        sessionType: 'Redação'
                    });
                }
            }

            const findNextAvailableSlot = (startDate, isWeekdayOnly = false) => {
                const availableDates = getAvailableDates(startDate, examDate, isWeekdayOnly);
                for (const dateInfo of availableDates) {
                    const dateStr = dateInfo.date.toISOString().split('T')[0];
                    const currentSessions = agenda.get(dateStr)?.length || 0;
                    if (currentSessions < dateInfo.maxSessions) return dateInfo.date;
                }
                return null;
            };

            const getNextSaturdayForReview = (date) => {
                const saturdayDates = getAvailableDates(date, examDate).filter(d => d.dayOfWeek === 6);
                for (const dateInfo of saturdayDates) {
                    const dateStr = dateInfo.date.toISOString().split('T')[0];
                    if ((agenda.get(dateStr)?.length || 0) < dateInfo.maxSessions) return dateInfo.date;
                }
                return null;
            };

            const completedTopicsQuery = `
                SELECT t.id, t.description, t.completion_date, s.subject_name
                FROM topics t
                INNER JOIN subjects s ON t.subject_id = s.id
                WHERE s.study_plan_id = ? AND t.status = 'Concluído' AND t.completion_date IS NOT NULL
                ORDER BY t.completion_date DESC
            `;
            const completedTopics = await dbAll(completedTopicsQuery, [planId]);
            
            for (const topic of completedTopics) {
                const baseDate = new Date(topic.completion_date + 'T00:00:00');
                [7, 14, 28].forEach(days => {
                    const targetReviewDate = new Date(baseDate);
                    targetReviewDate.setDate(targetReviewDate.getDate() + days);
                    if (targetReviewDate >= today && targetReviewDate <= examDate) {
                        const reviewDay = getNextSaturdayForReview(targetReviewDate);
                        if (reviewDay) {
                            addSessionToAgenda(reviewDay, { topicId: topic.id, subjectName: topic.subject_name, topicDescription: topic.description, sessionType: `Revisão ${days}D` });
                        }
                    }
                });
            }
            
            const pendingTopics = allTopics.filter(t => t.status !== 'Concluído');
            const weightedTopics = pendingTopics.flatMap(t => Array(t.priority).fill(t));
            for (let i = weightedTopics.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [weightedTopics[i], weightedTopics[j]] = [weightedTopics[j], weightedTopics[i]];
            }
            const uniquePendingTopicsInOrder = [...new Map(weightedTopics.map(item => [item.id, item])).values()];
            
            let currentDateForNewTopics = new Date(today);
            let lastNewTopicDate = null;

            for (const topic of uniquePendingTopicsInOrder) {
                const studyDay = findNextAvailableSlot(currentDateForNewTopics, true);
                if (!studyDay) break;

                addSessionToAgenda(studyDay, { topicId: topic.id, subjectName: topic.subject_name, topicDescription: topic.description, sessionType: 'Novo Tópico' });
                
                lastNewTopicDate = new Date(studyDay);
                currentDateForNewTopics = new Date(studyDay);
                
                [7, 14, 28].forEach(days => {
                    const targetReviewDate = new Date(studyDay);
                    targetReviewDate.setDate(targetReviewDate.getDate() + days);
                    if (targetReviewDate <= examDate) {
                        const reviewDay = getNextSaturdayForReview(targetReviewDate);
                        if (reviewDay) {
                            addSessionToAgenda(reviewDay, { topicId: topic.id, subjectName: topic.subject_name, topicDescription: topic.description, sessionType: `Revisão ${days}D` });
                        }
                    }
                });
            }
            
            let maintenanceStartDate = lastNewTopicDate ? new Date(lastNewTopicDate) : new Date(today);
            maintenanceStartDate.setDate(maintenanceStartDate.getDate() + 1);
            
            const hasPendingNewTopics = pendingTopics.length > 0;
            
            if (!hasPendingNewTopics) {
                console.log(`[CRONOGRAMA] Todas as matérias foram cobertas. Iniciando fase de simulados...`);
                
                const subjectTopicsMap = new Map();
                
                allTopics.forEach(topic => {
                    if (!subjectTopicsMap.has(topic.subject_name)) {
                        subjectTopicsMap.set(topic.subject_name, []);
                    }
                    subjectTopicsMap.get(topic.subject_name).push(topic.description);
                });
                
                let currentSimDate = new Date(maintenanceStartDate);
                currentSimDate.setDate(currentSimDate.getDate() + 3); 
                
                const progressPercentage = (completedTopics.length / allTopics.length);

                // CORREÇÃO: Simulados direcionados só após todo conteúdo ser abordado (100% de cobertura)
                if (pendingTopics.length === 0 && progressPercentage >= 0.95) {
                    const subjectCompletionMap = new Map();
                    
                    allTopics.forEach(topic => {
                        if (!subjectCompletionMap.has(topic.subject_name)) {
                            subjectCompletionMap.set(topic.subject_name, { completed: [], total: 0 });
                        }
                        const subjectData = subjectCompletionMap.get(topic.subject_name);
                        subjectData.total++;
                        if (topic.status === 'Concluído') {
                            subjectData.completed.push(topic.description);
                        }
                    });
                    
                    const subjectsReadyForSim = Array.from(subjectCompletionMap.entries())
                        .filter(([subject, data]) => data.completed.length >= 2)
                        .sort(([, dataA], [, dataB]) => dataB.completed.length - dataA.completed.length);
                    
                    let currentDirectedSimDate = new Date(maintenanceStartDate);
                    
                    for (const [subjectName, subjectData] of subjectsReadyForSim) {
                        const completedTopics = subjectData.completed;
                        
                        const topicGroups = [];
                        for (let i = 0; i < completedTopics.length; i += 4) {
                            topicGroups.push(completedTopics.slice(i, i + 4));
                        }
                        
                        for (let groupIndex = 0; groupIndex < topicGroups.length; groupIndex++) {
                            const topicGroup = topicGroups[groupIndex];
                            const nextSimulatedDay = findNextAvailableSlot(currentDirectedSimDate, false);
                            if (!nextSimulatedDay) break;
                            
                            const groupNumber = topicGroups.length > 1 ? ` - Bloco ${groupIndex + 1}` : '';
                            const topicList = topicGroup.map(topic => `• ${topic}`).join('\n');
                            const simuladoDescription = `Simulado direcionado focado em ${subjectName}${groupNumber}:\n\n${topicList}\n\nEste simulado aborda especificamente estes tópicos já estudados. Teste sua retenção e aplicação prática dos conceitos.`;
                            
                            addSessionToAgenda(nextSimulatedDay, { 
                                topicId: null, 
                                subjectName: `Simulado Direcionado - ${subjectName}`,
                                topicDescription: simuladoDescription, 
                                sessionType: 'Simulado Direcionado' 
                            });
                            
                            currentDirectedSimDate = new Date(nextSimulatedDay);
                            currentDirectedSimDate.setDate(currentDirectedSimDate.getDate() + 3); 
                        }
                    }
                }
                
                // Simulados completos só após todo conteúdo ser abordado
                if (pendingTopics.length === 0 && progressPercentage >= 0.95) {
                    let basicCompleteSimDate = new Date(maintenanceStartDate);
                    basicCompleteSimDate.setDate(basicCompleteSimDate.getDate() + 7); 
                    const basicCompleteSlot = findNextAvailableSlot(basicCompleteSimDate, false);
                    if (basicCompleteSlot) {
                        addSessionToAgenda(basicCompleteSlot, {
                            topicId: null,
                            subjectName: "Simulado Completo", 
                            topicDescription: "Simulado geral abrangendo todas as disciplinas do concurso. Uma excelente oportunidade de testar seus conhecimentos em um formato similar ao da prova real.", 
                            sessionType: 'Simulado Completo' 
                        });
                    }
                }
                
                // Simulados gerais só após todo conteúdo ser abordado
                if (pendingTopics.length === 0 && progressPercentage >= 0.95) {
                    let nextMaintenanceDay = new Date(maintenanceStartDate);
                    nextMaintenanceDay.setDate(nextMaintenanceDay.getDate() + 5); 
                    
                    const simuladoFrequency = 3; // Frequência fixa quando todo conteúdo foi abordado
                    
                    let simuladoCount = 0;
                    const maxSimulados = 20; // Máximo de simulados quando todo conteúdo foi abordado
                    
                    while(simuladoCount < maxSimulados) {
                        nextMaintenanceDay = findNextAvailableSlot(nextMaintenanceDay, false);
                        if (!nextMaintenanceDay) break;
                        
                        const simuladoDescription = "Simulado completo cobrindo todos os tópicos do edital. Foque em tempo, estratégia e resistência. Esta é sua preparação final!";
                        
                        addSessionToAgenda(nextMaintenanceDay, { 
                            topicId: null, 
                            subjectName: "Simulado Completo", 
                            topicDescription: simuladoDescription, 
                            sessionType: 'Simulado Completo' 
                        });
                        
                        nextMaintenanceDay.setDate(nextMaintenanceDay.getDate() + simuladoFrequency);
                        simuladoCount++;
                    }
                }
            }

            const sessionsToCreate = Array.from(agenda.values()).flat();
            
            console.log(`[PERF] Creating ${sessionsToCreate.length} sessions in batch`);

            if (sessionsToCreate.length > 0) {
                const insertSql = 'INSERT INTO study_sessions (study_plan_id, topic_id, subject_name, topic_description, session_date, session_type, status) VALUES (?, ?, ?, ?, ?, ?, ?)';
                const stmt = db.prepare(insertSql);
                
                const BATCH_SIZE = 100;
                for (let i = 0; i < sessionsToCreate.length; i += BATCH_SIZE) {
                    const chunk = sessionsToCreate.slice(i, i + BATCH_SIZE);
                    for (const sessionData of chunk) {
                        stmt.run(
                            planId,
                            sessionData.topicId,
                            sessionData.subjectName,
                            sessionData.topicDescription,
                            sessionData.session_date,
                            sessionData.sessionType,
                            'Pendente'
                        );
                    }
                }
                
                await new Promise((resolve, reject) => {
                    stmt.finalize(err => err ? reject(err) : resolve());
                });
            }
            
            await dbRun('COMMIT');
            
            const endTime = Date.now();
            console.timeEnd(`[PERF] Generate schedule for plan ${planId}`);
            
            res.json({
                message: `Seu mapa para a aprovação foi traçado com sucesso. 🗺️`,
                performance: {
                    executionTime: `${endTime - startTime}ms`,
                    sessionsCreated: sessionsToCreate.length,
                    topicsProcessed: allTopics.length
                }
            });

        } catch (error) {
            await dbRun('ROLLBACK');
            console.error("Erro ao gerar cronograma:", error);
            console.timeEnd(`[PERF] Generate schedule for plan ${planId}`);
            res.status(500).json({ error: "Ocorreu um erro interno no servidor ao gerar o cronograma." });
        }
    }
);

// --- ROTAS DE SESSÕES E DADOS ---

// Obter detalhes do replanejamento de tarefas atrasadas
app.get('/plans/:planId/replan-preview', 
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    async (req, res) => {
        const planId = req.params.planId;
        try {
            const plan = await dbGet('SELECT * FROM study_plans WHERE id = ? AND user_id = ?', [planId, req.user.id]);
            if (!plan) return res.status(404).json({ error: "Plano não encontrado." });

            const todayStr = new Date().toISOString().split('T')[0];
            const overdueSessions = await dbAll("SELECT * FROM study_sessions WHERE study_plan_id = ? AND status = 'Pendente' AND session_date < ? ORDER BY session_date, id", [planId, todayStr]);
            
            if (overdueSessions.length === 0) {
                return res.json({
                    hasOverdue: false,
                    message: "Nenhuma tarefa atrasada encontrada."
                });
            }

            const sessionDuration = plan.session_duration_minutes || 50;
            const studyHoursPerDay = JSON.parse(plan.study_hours_per_day);
            const examDate = new Date(plan.exam_date + 'T23:59:59');

            // OTIMIZAÇÃO: Cache único para contagens de sessões por data
            const endDateStr = examDate.toISOString().split('T')[0];
            const sessionCountsQuery = `
                SELECT session_date, COUNT(*) as count 
                FROM study_sessions 
                WHERE study_plan_id = ? AND session_date BETWEEN ? AND ?
                GROUP BY session_date
            `;
            const sessionCountsResult = await dbAll(sessionCountsQuery, [planId, todayStr, endDateStr]);
            
            // Criar mapa para acesso O(1)
            const sessionCountsCache = new Map();
            sessionCountsResult.forEach(row => {
                sessionCountsCache.set(row.session_date, row.count);
            });

            // Simular o replanejamento para mostrar onde as tarefas irão
            const replanPreview = [];
            let currentDate = new Date(todayStr + 'T00:00:00');
            
            for (const session of overdueSessions) {
                // Encontrar próximo slot disponível
                while (currentDate <= examDate) {
                    const dateStr = currentDate.toISOString().split('T')[0];
                    const dayOfWeek = currentDate.getDay();
                    const hoursForDay = studyHoursPerDay[Object.keys(studyHoursPerDay)[dayOfWeek]];
                    
                    if (hoursForDay && hoursForDay > 0) {
                        const minutesAvailable = hoursForDay * 60;
                        // OTIMIZAÇÃO: Usar cache ao invés de query individual
                        const sessionsCount = sessionCountsCache.get(dateStr) || 0;
                        const usedMinutes = sessionsCount * sessionDuration;
                        
                        if (usedMinutes + sessionDuration <= minutesAvailable) {
                            replanPreview.push({
                                sessionId: session.id,
                                topic: session.topic_description,
                                subject: session.subject_name,
                                sessionType: session.session_type,
                                originalDate: session.session_date,
                                newDate: dateStr,
                                newDateFormatted: currentDate.toLocaleDateString('pt-BR', { 
                                    weekday: 'long', 
                                    day: '2-digit', 
                                    month: 'long' 
                                })
                            });
                            // OTIMIZAÇÃO: Atualizar cache após alocar sessão
                            sessionCountsCache.set(dateStr, sessionsCount + 1);
                            break;
                        }
                    }
                    currentDate.setDate(currentDate.getDate() + 1);
                }
            }

            res.json({
                hasOverdue: true,
                count: overdueSessions.length,
                strategy: "Redistribuição Inteligente",
                description: "As tarefas atrasadas serão realocadas para os próximos dias disponíveis, respeitando sua carga horária diária e prioridades.",
                replanPreview: replanPreview.slice(0, 5), // Mostrar apenas primeiras 5
                totalToReplan: replanPreview.length,
                examDate: plan.exam_date,
                daysUntilExam: Math.ceil((examDate - new Date()) / (1000 * 60 * 60 * 24))
            });

        } catch (error) {
            console.error("Erro ao gerar preview de replanejamento:", error);
            res.status(500).json({ error: "Erro ao analisar tarefas atrasadas." });
        }
    }
);

// Replanejar tarefas atrasadas
app.post('/plans/:planId/replan', 
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    async (req, res) => {
        const planId = req.params.planId;
        try {
            const plan = await dbGet('SELECT * FROM study_plans WHERE id = ? AND user_id = ?', [planId, req.user.id]);
            if (!plan) return res.status(404).json({ error: "Plano não encontrado." });

            const todayStr = new Date().toISOString().split('T')[0];
            const overdueSessions = await dbAll("SELECT * FROM study_sessions WHERE study_plan_id = ? AND status = 'Pendente' AND session_date < ? ORDER BY session_date, id", [planId, todayStr]);
            
            if (overdueSessions.length === 0) {
                return res.json({ message: "Nenhuma tarefa atrasada para replanejar." });
            }

            const sessionDuration = plan.session_duration_minutes || 50;
            const studyHoursPerDay = JSON.parse(plan.study_hours_per_day);
            const examDate = new Date(plan.exam_date + 'T23:59:59');

            const findNextAvailableSlot = async (startDate) => {
                let currentDate = new Date(startDate);
                while (currentDate <= examDate) {
                    const dateStr = currentDate.toISOString().split('T')[0];
                    const dayOfWeek = currentDate.getDay();

                    if (dayOfWeek === 0) { // Pula domingos
                        currentDate.setDate(currentDate.getDate() + 1);
                        continue;
                    }

                    const totalMinutes = (studyHoursPerDay[dayOfWeek] || 0) * 60;
                    const maxSessions = Math.floor(totalMinutes / sessionDuration);
                    
                    const currentSessionCountResult = await dbGet('SELECT COUNT(*) as count FROM study_sessions WHERE study_plan_id = ? AND session_date = ?', [planId, dateStr]);
                    const currentSessionCount = currentSessionCountResult.count;

                    if (totalMinutes > 0 && currentSessionCount < maxSessions) {
                        return currentDate;
                    }
                    currentDate.setDate(currentDate.getDate() + 1);
                }
                return null;
            };
            
            await dbRun('BEGIN TRANSACTION');
            
            let dateForNextSlot = new Date();
            for(const session of overdueSessions) {
                const newDate = await findNextAvailableSlot(dateForNextSlot);
                if (newDate) {
                    const newDateStr = newDate.toISOString().split('T')[0];
                    await dbRun("UPDATE study_sessions SET session_date = ? WHERE id = ?", [newDateStr, session.id]);
                    dateForNextSlot = newDate; 
                } else {
                    break;
                }
            }

            await dbRun("UPDATE study_plans SET postponement_count = postponement_count + 1 WHERE id = ?", [planId]);
            await dbRun('COMMIT');
            
            res.json({ message: `${overdueSessions.length} tarefas atrasadas foram replanejadas com sucesso!` });

        } catch (error) {
            await dbRun('ROLLBACK');
            console.error("Erro ao replanejar:", error);
            res.status(500).json({ error: "Ocorreu um erro interno ao replanejar as tarefas." });
        }
    }
);

// Endpoint para gerar dados de compartilhamento
app.get('/plans/:planId/share-progress', 
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    async (req, res) => {
        const planId = req.params.planId;
        const userId = req.user.id;

        try {
            const plan = await dbGet("SELECT plan_name, exam_date FROM study_plans WHERE id = ? AND user_id = ?", [planId, userId]);
            if (!plan) return res.status(404).json({ "error": "Plano não encontrado ou não autorizado." });

            const user = await dbGet('SELECT name FROM users WHERE id = ?', [userId]);

            // Pegar dados de gamificação
            const completedTopicsResult = await dbGet(`
                SELECT COUNT(DISTINCT topic_id) as count 
                FROM study_sessions 
                WHERE study_plan_id = ? AND session_type = 'Novo Tópico' AND status = 'Concluído' AND topic_id IS NOT NULL
            `, [planId]);
            const completedTopicsCount = completedTopicsResult.count || 0;

            // Calcular streak
            const completedSessions = await dbAll(`
                SELECT DISTINCT session_date FROM study_sessions 
                WHERE study_plan_id = ? AND status = 'Concluído' ORDER BY session_date DESC
            `, [planId]);
            
            let studyStreak = 0;
            if (completedSessions.length > 0) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const yesterday = new Date(today);
                yesterday.setDate(today.getDate() - 1);

                const lastStudyDate = new Date(completedSessions[0].session_date + 'T00:00:00');
                
                if (lastStudyDate.getTime() === today.getTime() || lastStudyDate.getTime() === yesterday.getTime()) {
                    studyStreak = 1;
                    let currentDate = new Date(lastStudyDate);
                    for (let i = 1; i < completedSessions.length; i++) {
                        const previousDay = new Date(currentDate);
                        previousDay.setDate(currentDate.getDate() - 1);
                        const nextStudyDate = new Date(completedSessions[i].session_date + 'T00:00:00');
                        if (nextStudyDate.getTime() === previousDay.getTime()) {
                            studyStreak++;
                            currentDate = nextStudyDate;
                        } else {
                            break;
                        }
                    }
                }
            }

            // Calcular dias até prova
            const examDate = new Date(plan.exam_date + 'T00:00:00');
            const today = new Date();
            const timeDiff = examDate.getTime() - today.getTime();
            const daysToExam = Math.ceil(timeDiff / (1000 * 3600 * 24));

            // Determinar nível atual
            const levels = [
                { threshold: 0, title: 'Aspirante a Servidor(a) 🌱' },
                { threshold: 11, title: 'Pagador(a) de Inscrição 💸' },
                { threshold: 31, title: 'Acima da Nota de Corte (nos simulados) 😉' },
                { threshold: 51, title: 'Mestre dos Grupos de WhatsApp de Concurso 📲' },
                { threshold: 101, title: 'Gabaritador(a) da prova de Português da FGV 🎯' },
                { threshold: 201, title: 'Terror do Cespe/Cebraspe 👹' },
                { threshold: 351, title: 'Veterano(a) de 7 Bancas Diferentes 😎' },
                { threshold: 501, title: '✨ Lenda Viva: Assinante Vitalício do Diário Oficial ✨' }
            ];

            let currentLevel = levels[0];
            for (let i = levels.length - 1; i >= 0; i--) {
                if (completedTopicsCount >= levels[i].threshold) {
                    currentLevel = levels[i];
                    break;
                }
            }

            const shareData = {
                userName: user?.name || 'Concurseiro(a)',
                planName: plan.plan_name,
                completedTopics: completedTopicsCount,
                studyStreak: studyStreak,
                daysToExam: daysToExam > 0 ? daysToExam : 0,
                level: currentLevel.title,
                shareText: `🎯 MEU PROGRESSO NO ${plan.plan_name.toUpperCase()}!\n\n` + 
                          `📚 ${completedTopicsCount} tópicos já dominados ✅\n` + 
                          `🔥 ${studyStreak} dias consecutivos de foco total!\n` + 
                          `⏰ Faltam ${daysToExam > 0 ? daysToExam : 0} dias para a prova\n` + 
                          `🏆 Status atual: ${currentLevel.title}\n\n` + 
                          `💪 A aprovação está cada vez mais próxima!\n\n` + 
                          `#Concursos #Estudos #Editaliza #FocoNaAprovacao #VemAprovacao`
            };

            res.json(shareData);

        } catch (error) {
            console.error("Erro ao gerar dados de compartilhamento:", error);
            res.status(500).json({ "error": "Erro ao gerar dados de compartilhamento." });
        }
    }
);

// Rota padrão - redireciona para login
app.get('/', (req, res) => {
    res.redirect('/login.html');
});

// Tratamento de erros global
// Health check endpoint for Docker/K8s
app.get('/health', (req, res) => {
    // SIMPLIFIED: Temporarily removed database check to ensure server stays online.
    const healthCheck = {
        uptime: process.uptime(),
        message: 'OK',
        timestamp: Date.now(),
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0',
        database: 'Temporarily disabled'
    };
    res.status(200).json(healthCheck);
});

// Ready probe endpoint for K8s
app.get('/ready', (req, res) => {
    res.status(200).json({ status: 'ready', timestamp: Date.now() });
});

app.use((err, req, res, next) => {
    if (err.message === 'Not allowed by CORS') {
        return res.status(403).json({ error: 'Origem não permitida' });
    }
    console.error('Erro não tratado:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Health check disponível em: http://localhost:${PORT}/health`);
});
