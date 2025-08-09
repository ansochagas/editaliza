const { Pool } = require('pg');
require('dotenv').config();

// Render e outras plataformas PaaS fornecem a URL de conexão na variável de ambiente DATABASE_URL.
// Esta é a maneira padrão e segura de se conectar.
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error("FATAL: A variável de ambiente DATABASE_URL não está definida.");
    console.error("Em produção, esta variável é fornecida pela plataforma de hospedagem (ex: Render).");
    // Em um ambiente de produção real, você pode querer que o aplicativo pare se o banco de dados não estiver disponível.
    // process.exit(1); 
}

const pool = new Pool({
  connectionString: connectionString,
  // Em produção, é crucial usar SSL para proteger a conexão com o banco de dados.
  // O Render exige e configura isso automaticamente.
  ssl: {
    rejectUnauthorized: false
  }
});

// Função para testar a conexão e garantir que o pool está pronto.
const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log("✅ Conexão com o PostgreSQL estabelecida com sucesso!");
    client.release();
  } catch (err) {
    console.error("❌ Erro ao conectar com o PostgreSQL:", err.stack);
    // Lançar o erro permite que o server.js decida como lidar com a falha na conexão.
    throw err;
  }
};

module.exports = {
  pool,
  testConnection,
  query: (text, params) => pool.query(text, params),
};