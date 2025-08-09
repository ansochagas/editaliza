// cloud-storage.js - Módulo para upload de arquivos para o Google Cloud Storage
const { Storage } = require('@google-cloud/storage');

// Cria uma instância do cliente do Storage.
// Em um ambiente do Google Cloud (como o Cloud Run), a autenticação
// é tratada automaticamente.
const storage = new Storage();

const bucketName = process.env.GCS_BUCKET_NAME;
if (!bucketName) {
    if (process.env.NODE_ENV === 'production') {
        console.error('ERRO: A variável de ambiente GCS_BUCKET_NAME não está definida.');
        // Em produção, isso seria um erro fatal, mas em desenvolvimento podemos permitir.
    }
}

/**
 * Faz o upload de um arquivo para o Google Cloud Storage.
 * @param {object} file - O objeto do arquivo, como o fornecido pelo multer.
 * @returns {Promise<string>} - A URL pública do arquivo no GCS.
 */
const uploadToGCS = (file) => {
    if (!bucketName) {
        return Promise.reject('Nome do bucket do GCS não configurado.');
    }
    const bucket = storage.bucket(bucketName);
    const blob = bucket.file(file.originalname);
    const blobStream = blob.createWriteStream({
        resumable: false,
    });

    return new Promise((resolve, reject) => {
        blobStream.on('error', (err) => {
            reject(err);
        });

        blobStream.on('finish', () => {
            const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
            resolve(publicUrl);
        });

        blobStream.end(file.buffer);
    });
};

module.exports = { uploadToGCS };
