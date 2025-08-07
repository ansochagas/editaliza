// tests/jest-setup.js - Configurações customizadas para Jest
const { toBeOneOf } = require('jest-extended');

// Adicionar matcher customizado
expect.extend({
    toBeOneOf
});

// Adicionar timeout global mais longo para testes de integração
jest.setTimeout(10000);