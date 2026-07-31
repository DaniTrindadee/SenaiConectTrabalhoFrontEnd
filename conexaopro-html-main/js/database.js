const path = require("path");
const { DatabaseSync } = require("node:sqlite");

// Caminho para o database.db na raiz do projeto
const DB_PATH = path.resolve(__dirname, "..", "database.db");

let db;

function conectar() {
    if (db) return db;

    db = new DatabaseSync(DB_PATH);

    // Ativar WAL mode para melhor performance e foreign keys
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA foreign_keys = ON");

    criarTabelas();

    // Migração: adicionar coluna 'tipo' se não existir (para bancos já criados)
    try {
        db.exec("ALTER TABLE usuarios ADD COLUMN tipo TEXT NOT NULL DEFAULT 'aluno'");
    } catch {
        // Coluna já existe, ignorar
    }

    // Migração: criar tabela de mensagens se não existir (para bancos já criados sem ela)
    try {
        db.exec(`
            CREATE TABLE IF NOT EXISTS mensagens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                remetente_id INTEGER NOT NULL,
                destinatario_id INTEGER NOT NULL,
                mensagem TEXT NOT NULL,
                lida INTEGER NOT NULL DEFAULT 0,
                criado_em TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (remetente_id) REFERENCES usuarios(id) ON DELETE CASCADE,
                FOREIGN KEY (destinatario_id) REFERENCES usuarios(id) ON DELETE CASCADE
            )
        `);
    } catch {
        // Tabela já existe, ignorar
    }

    // Seed: criar admin padrão se não existir
    const adminExistente = db.prepare("SELECT id FROM usuarios WHERE matricula = ?").get("admin");
    if (!adminExistente) {
        db.prepare(`
            INSERT INTO usuarios (nome, matricula, curso, senha, tipo)
            VALUES (?, ?, ?, ?, ?)
        `).run("Administrador Master", "admin", "Administração", "admin123", "admin");
        console.log("✅ Admin padrão criado (matrícula: admin, senha: admin123)");
    }

    return db;
}

function criarTabelas() {
    db.exec(`
        -- ===== USUÁRIOS =====
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            matricula TEXT NOT NULL UNIQUE,
            curso TEXT NOT NULL DEFAULT '',
            senha TEXT NOT NULL,
            tipo TEXT NOT NULL DEFAULT 'aluno' CHECK(tipo IN ('aluno', 'professor', 'admin')),
            foto TEXT DEFAULT '',
            sobre TEXT DEFAULT '',
            xp INTEGER DEFAULT 0,
            nivel INTEGER DEFAULT 1,
            criado_em TEXT DEFAULT (datetime('now')),
            atualizado_em TEXT DEFAULT (datetime('now'))
        );

        -- ===== SESSÕES =====
        CREATE TABLE IF NOT EXISTS sessoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL,
            token TEXT NOT NULL UNIQUE,
            criado_em TEXT DEFAULT (datetime('now')),
            expira_em TEXT NOT NULL,
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
        );

        -- ===== CONEXÕES (seguir/conectar usuários) =====
        CREATE TABLE IF NOT EXISTS conexoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            solicitante_id INTEGER NOT NULL,
            destinatario_id INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'pendente' CHECK(status IN ('pendente', 'aceita', 'recusada')),
            criado_em TEXT DEFAULT (datetime('now')),
            atualizado_em TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (solicitante_id) REFERENCES usuarios(id) ON DELETE CASCADE,
            FOREIGN KEY (destinatario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
            UNIQUE(solicitante_id, destinatario_id)
        );

        -- ===== MENSAGENS =====
        CREATE TABLE IF NOT EXISTS mensagens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            remetente_id INTEGER NOT NULL,
            destinatario_id INTEGER NOT NULL,
            mensagem TEXT NOT NULL,
            lida INTEGER NOT NULL DEFAULT 0,
            criado_em TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (remetente_id) REFERENCES usuarios(id) ON DELETE CASCADE,
            FOREIGN KEY (destinatario_id) REFERENCES usuarios(id) ON DELETE CASCADE
        );

        -- ===== ÍNDICES =====
        CREATE INDEX IF NOT EXISTS idx_sessoes_token ON sessoes(token);
        CREATE INDEX IF NOT EXISTS idx_sessoes_usuario ON sessoes(usuario_id);
        CREATE INDEX IF NOT EXISTS idx_conexoes_solicitante ON conexoes(solicitante_id);
        CREATE INDEX IF NOT EXISTS idx_conexoes_destinatario ON conexoes(destinatario_id);
        CREATE INDEX IF NOT EXISTS idx_conexoes_status ON conexoes(status);
        CREATE INDEX IF NOT EXISTS idx_usuarios_matricula ON usuarios(matricula);
    `);
}

function getDb() {
    if (!db) conectar();
    return db;
}

module.exports = { conectar, getDb };

