// middleware.js
const { body, param, query, validationResult } = require('express-validator');
const xss = require('xss');
const jwt = require('jsonwebtoken');

// Função para sanitizar inputs contra XSS
const sanitizeInput = (input) => {
    if (typeof input === 'string') {
        return xss(input);
    } else if (Array.isArray(input)) { // Adicionar tratamento explícito para arrays
        return input.map(item => sanitizeInput(item)); // Sanitiza cada item do array
    } else if (typeof input === 'object' && input !== null) {
        const sanitized = {};
        for (const key in input) {
            sanitized[key] = sanitizeInput(input[key]);
        }
        return sanitized;
    }
    return input;
};

// Middleware para sanitizar todos os inputs
const sanitizeMiddleware = (req, res, next) => {
    req.body = sanitizeInput(req.body);
    req.query = sanitizeInput(req.query);
    req.params = sanitizeInput(req.params);
    next();
};

// Middleware para verificar erros de validação
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
    }
    next();
};

// Middleware aprimorado de autenticação com verificação adicional
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Token de autenticação não fornecido' });
    }
    
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ error: 'Token expirado. Por favor, faça login novamente.' });
            }
            return res.status(403).json({ error: 'Token inválido' });
        }
        
        // Verificar se o token tem as informações necessárias
        if (!user.id || !user.email) {
            return res.status(403).json({ error: 'Token malformado' });
        }
        
        req.user = user;
        next();
    });
};

// Validações comuns
const validators = {
    // Validação de email
    email: body('email')
        .isEmail().withMessage('Email inválido')
        .normalizeEmail(),
    
    // Validação de senha
    password: body('password')
        .isLength({ min: 6 }).withMessage('A senha deve ter no mínimo 6 caracteres')
        .matches(/^[\w!@#$%^&*(),.?":{}|<>]+$/).withMessage('A senha contém caracteres inválidos'),
    
    // Validação de ID numérico
    numericId: (paramName) => param(paramName)
        .isInt({ min: 1 }).withMessage('ID inválido')
        .toInt(),
    
    // Validação de data
    date: (fieldName) => body(fieldName)
        .isISO8601().withMessage('Data inválida')
        .custom((value) => {
            const date = new Date(value);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return date >= today;
        }).withMessage('A data não pode ser no passado'),
    
    // Validação de texto com limite
    text: (fieldName, minLength = 1, maxLength = 1000) => body(fieldName)
        .isLength({ min: minLength, max: maxLength })
        .withMessage(`O campo deve ter entre ${minLength} e ${maxLength} caracteres`)
        .trim(),
    
    // Validação de número inteiro com range
    integer: (fieldName, min = 0, max = 1000) => body(fieldName)
        .isInt({ min, max })
        .withMessage(`O valor deve estar entre ${min} e ${max}`)
        .toInt(),
    
    // Validação de JSON
    jsonField: (fieldName) => body(fieldName)
        .custom((value) => {
            try {
                if (typeof value === 'object') return true;
                JSON.parse(value);
                return true;
            } catch {
                return false;
            }
        }).withMessage('JSON inválido')
};

// Middleware para prevenir SQL injection em campos de ordenação
const validateOrderBy = (allowedFields) => {
    return (req, res, next) => {
        if (req.query.orderBy && !allowedFields.includes(req.query.orderBy)) {
            return res.status(400).json({ error: 'Campo de ordenação inválido' });
        }
        next();
    };
};

// Middleware para limitar tamanho do corpo da requisição
const bodySizeLimit = (maxSize = '10mb') => {
    return (req, res, next) => {
        const contentLength = req.headers['content-length'];
        const maxBytes = parseInt(maxSize) * 1024 * 1024;
        
        if (contentLength && parseInt(contentLength) > maxBytes) {
            return res.status(413).json({ error: 'Requisição muito grande' });
        }
        next();
    };
};

module.exports = {
    sanitizeInput,
    sanitizeMiddleware,
    handleValidationErrors,
    authenticateToken,
    validators,
    validateOrderBy,
    bodySizeLimit
};