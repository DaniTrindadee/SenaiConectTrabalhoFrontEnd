const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const { conectar } = require("./database");

const path = require("path");
const app = express();
const PORT = 3000;

// ===== MIDDLEWARE =====
app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json({ limit: "50mb" })); // Para fotos em base64

// ===== ARQUIVOS ESTÁTICOS (front-end) =====
app.use(express.static(path.join(__dirname)));

// Inicializar banco de dados
const db = conectar();

// ===== HELPERS =====

function gerarToken() {
    return uuidv4();
}

function validarSessao(token) {
    if (!token) return null;
    const sessao = db.prepare(`
        SELECT u.id, u.nome, u.matricula, u.curso, u.foto, u.sobre, u.nivel, u.xp, u.tipo,
               s.token, s.criado_em, s.expira_em, s.usuario_id
        FROM sessoes s
        JOIN usuarios u ON s.usuario_id = u.id
        WHERE s.token = ? AND s.expira_em > datetime('now')
    `).get(token);
    return sessao || null;
}

function authMiddleware(req, res, next) {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const sessao = validarSessao(token);
    if (!sessao) {
        return res.status(401).json({ erro: "Sessão inválida ou expirada." });
    }
    req.usuario = sessao;
    next();
}

function adminMiddleware(req, res, next) {
    if (req.usuario.tipo !== 'admin') {
        return res.status(403).json({ erro: "Apenas administradores podem acessar esta funcionalidade." });
    }
    next();
}

// ===== ROTAS DE AUTENTICAÇÃO =====

// Cadastro
app.post("/api/auth/cadastro", (req, res) => {
    try {
        const { nome, matricula, curso, senha } = req.body;

        if (!nome?.trim() || !matricula?.trim() || !senha) {
            return res.status(400).json({ erro: "Preencha todos os campos obrigatórios." });
        }

        if (senha.length < 4) {
            return res.status(400).json({ erro: "A senha precisa ter pelo menos 4 caracteres." });
        }

        // Verificar se matrícula já existe
        const existente = db.prepare("SELECT id FROM usuarios WHERE matricula = ?").get(matricula.trim());
        if (existente) {
            return res.status(409).json({ erro: "Esta matrícula já está cadastrada." });
        }

        // Inserir usuário
        const resultado = db.prepare(`
            INSERT INTO usuarios (nome, matricula, curso, senha)
            VALUES (?, ?, ?, ?)
        `).run(nome.trim(), matricula.trim(), curso || "", senha);

        // Criar sessão automaticamente (opcional, mas mantemos compatível)
        const token = gerarToken();
        const expiraEm = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        db.prepare("INSERT INTO sessoes (usuario_id, token, expira_em) VALUES (?, ?, ?)").run(resultado.lastInsertRowid, token, expiraEm);

        res.status(201).json({
            mensagem: "Cadastro criado com sucesso!",
            token,
            usuario: {
                id: resultado.lastInsertRowid,
                nome: nome.trim(),
                matricula: matricula.trim(),
                curso: curso || ""
            }
        });
    } catch (erro) {
        console.error("Erro no cadastro:", erro);
        res.status(500).json({ erro: "Erro interno ao realizar cadastro." });
    }
});

// Login
app.post("/api/auth/login", (req, res) => {
    try {
        const { matricula, senha } = req.body;

        if (!matricula?.trim() || !senha) {
            return res.status(400).json({ erro: "Matrícula e senha são obrigatórios." });
        }

        const usuario = db.prepare("SELECT * FROM usuarios WHERE matricula = ?").get(matricula.trim());
        if (!usuario || usuario.senha !== senha) {
            return res.status(401).json({ erro: "Matrícula ou senha inválida." });
        }

        // Criar nova sessão
        const token = gerarToken();
        const expiraEm = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        db.prepare("INSERT INTO sessoes (usuario_id, token, expira_em) VALUES (?, ?, ?)").run(usuario.id, token, expiraEm);

        res.json({
            mensagem: "Login realizado!",
            token,
            usuario: {
                id: usuario.id,
                nome: usuario.nome,
                matricula: usuario.matricula,
                curso: usuario.curso,
                foto: usuario.foto || "",
                sobre: usuario.sobre || "",
                nivel: usuario.nivel,
                xp: usuario.xp
            }
        });
    } catch (erro) {
        console.error("Erro no login:", erro);
        res.status(500).json({ erro: "Erro interno ao realizar login." });
    }
});

// Validar sessão
app.get("/api/auth/sessao", authMiddleware, (req, res) => {
    res.json({
        valido: true,
        usuario: {
            id: req.usuario.id,
            nome: req.usuario.nome,
            matricula: req.usuario.matricula,
            curso: req.usuario.curso,
            foto: req.usuario.foto || "",
            sobre: req.usuario.sobre || "",
            nivel: req.usuario.nivel,
            xp: req.usuario.xp
        }
    });
});

// Sair (logout)
app.delete("/api/auth/sair", authMiddleware, (req, res) => {
    try {
        db.prepare("DELETE FROM sessoes WHERE token = ?").run(req.headers.authorization?.replace("Bearer ", ""));
        res.json({ mensagem: "Sessão encerrada." });
    } catch (erro) {
        console.error("Erro ao sair:", erro);
        res.status(500).json({ erro: "Erro ao encerrar sessão." });
    }
});

// ===== ROTAS DE USUÁRIOS =====

// Listar todos os usuários (para conexões)
app.get("/api/usuarios", authMiddleware, (req, res) => {
    try {
        const usuarios = db.prepare(`
            SELECT id, nome, matricula, curso, foto, sobre, nivel, criado_em
            FROM usuarios
            WHERE id != ?
            ORDER BY nome ASC
        `).all(req.usuario.id);

        res.json(usuarios);
    } catch (erro) {
        console.error("Erro ao listar usuários:", erro);
        res.status(500).json({ erro: "Erro ao listar usuários." });
    }
});

// Buscar usuário por ID
app.get("/api/usuarios/:id", authMiddleware, (req, res) => {
    try {
        const usuario = db.prepare(`
            SELECT id, nome, matricula, curso, foto, sobre, nivel, xp, criado_em
            FROM usuarios WHERE id = ?
        `).get(req.params.id);

        if (!usuario) {
            return res.status(404).json({ erro: "Usuário não encontrado." });
        }

        res.json(usuario);
    } catch (erro) {
        console.error("Erro ao buscar usuário:", erro);
        res.status(500).json({ erro: "Erro ao buscar usuário." });
    }
});

// Atualizar perfil (foto, sobre)
app.put("/api/usuarios/perfil", authMiddleware, (req, res) => {
    try {
        const { foto, sobre } = req.body;
        const updates = [];
        const params = [];

        if (foto !== undefined) {
            updates.push("foto = ?");
            params.push(foto);
        }
        if (sobre !== undefined) {
            updates.push("sobre = ?");
            params.push(sobre);
        }

        if (updates.length === 0) {
            return res.status(400).json({ erro: "Nenhum campo para atualizar." });
        }

        updates.push("atualizado_em = datetime('now')");
        params.push(req.usuario.id);

        db.prepare(`UPDATE usuarios SET ${updates.join(", ")} WHERE id = ?`).run(...params);

        res.json({ mensagem: "Perfil atualizado!" });
    } catch (erro) {
        console.error("Erro ao atualizar perfil:", erro);
        res.status(500).json({ erro: "Erro ao atualizar perfil." });
    }
});

// ===== ROTAS DE CONEXÕES =====

// Enviar solicitação de conexão
app.post("/api/conexoes/solicitar", authMiddleware, (req, res) => {
    try {
        const { destinatario_id } = req.body;

        if (!destinatario_id || destinatario_id === req.usuario.id) {
            return res.status(400).json({ erro: "ID de destinatário inválido." });
        }

        // Verificar se destinatário existe
        const destinatario = db.prepare("SELECT id FROM usuarios WHERE id = ?").get(destinatario_id);
        if (!destinatario) {
            return res.status(404).json({ erro: "Usuário não encontrado." });
        }

        // Verificar se já existe conexão
        const existente = db.prepare(`
            SELECT id, status FROM conexoes 
            WHERE (solicitante_id = ? AND destinatario_id = ?)
               OR (solicitante_id = ? AND destinatario_id = ?)
        `).get(req.usuario.id, destinatario_id, destinatario_id, req.usuario.id);

        if (existente) {
            if (existente.status === "aceita") {
                return res.status(409).json({ erro: "Vocês já estão conectados." });
            }
            if (existente.status === "pendente") {
                return res.status(409).json({ erro: "Solicitação de conexão já foi enviada." });
            }
            // Se recusada, permitir reenviar (atualizar)
            db.prepare("UPDATE conexoes SET status = 'pendente', atualizado_em = datetime('now') WHERE id = ?").run(existente.id);
            return res.json({ mensagem: "Solicitação de conexão enviada novamente!" });
        }

        // Criar nova solicitação
        db.prepare("INSERT INTO conexoes (solicitante_id, destinatario_id) VALUES (?, ?)").run(req.usuario.id, destinatario_id);

        res.status(201).json({ mensagem: "Solicitação de conexão enviada!" });
    } catch (erro) {
        console.error("Erro ao solicitar conexão:", erro);
        res.status(500).json({ erro: "Erro ao solicitar conexão." });
    }
});

// Aceitar/recusar solicitação
app.put("/api/conexoes/:id/:acao", authMiddleware, (req, res) => {
    try {
        const { id, acao } = req.params;

        if (!["aceitar", "recusar"].includes(acao)) {
            return res.status(400).json({ erro: "Ação inválida. Use 'aceitar' ou 'recusar'." });
        }

        const conexao = db.prepare("SELECT * FROM conexoes WHERE id = ?").get(id);
        if (!conexao) {
            return res.status(404).json({ erro: "Conexão não encontrada." });
        }

        // Apenas o destinatário pode aceitar/recusar
        if (conexao.destinatario_id !== req.usuario.id) {
            return res.status(403).json({ erro: "Você não tem permissão para responder a esta solicitação." });
        }

        const novoStatus = acao === "aceitar" ? "aceita" : "recusada";
        db.prepare("UPDATE conexoes SET status = ?, atualizado_em = datetime('now') WHERE id = ?").run(novoStatus, id);

        const mensagem = acao === "aceitar" ? "Conexão aceita!" : "Solicitação recusada.";
        res.json({ mensagem, status: novoStatus });
    } catch (erro) {
        console.error("Erro ao responder conexão:", erro);
        res.status(500).json({ erro: "Erro ao responder conexão." });
    }
});

// Listar conexões do usuário logado
app.get("/api/conexoes", authMiddleware, (req, res) => {
    try {
        // Conexões aceitas (ambos os lados)
        const aceitas = db.prepare(`
            SELECT c.id, c.status, c.criado_em,
                   u.id as usuario_id, u.nome, u.matricula, u.curso, u.foto, u.nivel
            FROM conexoes c
            JOIN usuarios u ON (CASE WHEN c.solicitante_id = ? THEN c.destinatario_id ELSE c.solicitante_id END) = u.id
            WHERE (c.solicitante_id = ? OR c.destinatario_id = ?) AND c.status = 'aceita'
        `).all(req.usuario.id, req.usuario.id, req.usuario.id);

        // Solicitações pendentes recebidas
        const pendentes = db.prepare(`
            SELECT c.id, c.status, c.criado_em,
                   u.id as usuario_id, u.nome, u.matricula, u.curso, u.foto, u.nivel
            FROM conexoes c
            JOIN usuarios u ON c.solicitante_id = u.id
            WHERE c.destinatario_id = ? AND c.status = 'pendente'
        `).all(req.usuario.id);

        // Solicitações enviadas pendentes
        const enviadas = db.prepare(`
            SELECT c.id, c.status, c.criado_em,
                   u.id as usuario_id, u.nome, u.matricula, u.curso, u.foto, u.nivel
            FROM conexoes c
            JOIN usuarios u ON c.destinatario_id = u.id
            WHERE c.solicitante_id = ? AND c.status = 'pendente'
        `).all(req.usuario.id);

        res.json({ aceitas, pendentes, enviadas });
    } catch (erro) {
        console.error("Erro ao listar conexões:", erro);
        res.status(500).json({ erro: "Erro ao listar conexões." });
    }
});

// Verificar status de conexão com um usuário específico
app.get("/api/conexoes/status/:usuarioId", authMiddleware, (req, res) => {
    try {
        const { usuarioId } = req.params;

        const conexao = db.prepare(`
            SELECT id, status, solicitante_id, destinatario_id
            FROM conexoes 
            WHERE (solicitante_id = ? AND destinatario_id = ?)
               OR (solicitante_id = ? AND destinatario_id = ?)
        `).get(req.usuario.id, usuarioId, usuarioId, req.usuario.id);

        if (!conexao) {
            return res.json({ status: "nenhuma" });
        }

        let relacao = conexao.status;
        if (conexao.status === "pendente") {
            relacao = conexao.solicitante_id === req.usuario.id ? "pendente_enviada" : "pendente_recebida";
        }

        res.json({
            id: conexao.id,
            status: relacao,
            solicitante_id: conexao.solicitante_id,
            destinatario_id: conexao.destinatario_id
        });
    } catch (erro) {
        console.error("Erro ao verificar status:", erro);
        res.status(500).json({ erro: "Erro ao verificar status." });
    }
});

// Desconectar (remover conexão)
app.delete("/api/conexoes/:id", authMiddleware, (req, res) => {
    try {
        const conexao = db.prepare("SELECT * FROM conexoes WHERE id = ?").get(req.params.id);
        if (!conexao) {
            return res.status(404).json({ erro: "Conexão não encontrada." });
        }

        // Apenas participantes podem remover
        if (conexao.solicitante_id !== req.usuario.id && conexao.destinatario_id !== req.usuario.id) {
            return res.status(403).json({ erro: "Você não tem permissão para remover esta conexão." });
        }

        db.prepare("DELETE FROM conexoes WHERE id = ?").run(req.params.id);
        res.json({ mensagem: "Conexão removida." });
    } catch (erro) {
        console.error("Erro ao remover conexão:", erro);
        res.status(500).json({ erro: "Erro ao remover conexão." });
    }
});

// ===== ROTAS DE MENSAGENS =====

// Enviar mensagem
app.post("/api/mensagens/enviar", authMiddleware, (req, res) => {
    try {
        const { destinatario_id, mensagem } = req.body;

        if (!destinatario_id || !mensagem?.trim()) {
            return res.status(400).json({ erro: "Destinatário e mensagem são obrigatórios." });
        }

        if (destinatario_id === req.usuario.id) {
            return res.status(400).json({ erro: "Você não pode enviar mensagem para si mesmo." });
        }

        // Verificar se destinatário existe
        const destinatario = db.prepare("SELECT id FROM usuarios WHERE id = ?").get(destinatario_id);
        if (!destinatario) {
            return res.status(404).json({ erro: "Usuário não encontrado." });
        }

        const resultado = db.prepare(`
            INSERT INTO mensagens (remetente_id, destinatario_id, mensagem)
            VALUES (?, ?, ?)
        `).run(req.usuario.id, destinatario_id, mensagem.trim());

        res.status(201).json({
            mensagem: "Mensagem enviada!",
            id: resultado.lastInsertRowid,
            criado_em: new Date().toISOString()
        });
    } catch (erro) {
        console.error("Erro ao enviar mensagem:", erro);
        res.status(500).json({ erro: "Erro ao enviar mensagem." });
    }
});

// Listar conversas do usuário logado
app.get("/api/mensagens/conversas", authMiddleware, (req, res) => {
    try {
        // Buscar conversas (usuários com quem trocou mensagens)
        const conversas = db.prepare(`
            SELECT DISTINCT
                u.id as usuario_id,
                u.nome,
                u.foto,
                u.curso,
                u.tipo,
                (SELECT m.mensagem FROM mensagens m 
                 WHERE (m.remetente_id = ? AND m.destinatario_id = u.id)
                    OR (m.remetente_id = u.id AND m.destinatario_id = ?)
                 ORDER BY m.criado_em DESC LIMIT 1) as ultima_mensagem,
                (SELECT m.criado_em FROM mensagens m 
                 WHERE (m.remetente_id = ? AND m.destinatario_id = u.id)
                    OR (m.remetente_id = u.id AND m.destinatario_id = ?)
                 ORDER BY m.criado_em DESC LIMIT 1) as ultimo_tempo,
                (SELECT COUNT(*) FROM mensagens m 
                 WHERE m.remetente_id = u.id AND m.destinatario_id = ? AND m.lida = 0) as nao_lidas
            FROM usuarios u
            WHERE u.id != ?
            AND EXISTS (
                SELECT 1 FROM mensagens m 
                WHERE (m.remetente_id = ? AND m.destinatario_id = u.id)
                   OR (m.remetente_id = u.id AND m.destinatario_id = ?)
            )
            ORDER BY ultimo_tempo DESC
        `).all(req.usuario.id, req.usuario.id, req.usuario.id, req.usuario.id, req.usuario.id, req.usuario.id, req.usuario.id, req.usuario.id);

        res.json(conversas);
    } catch (erro) {
        console.error("Erro ao listar conversas:", erro);
        res.status(500).json({ erro: "Erro ao listar conversas." });
    }
});

// Buscar mensagens com um usuário específico
app.get("/api/mensagens/:usuarioId", authMiddleware, (req, res) => {
    try {
        const { usuarioId } = req.params;

        // Marcar mensagens recebidas como lidas
        db.prepare(`
            UPDATE mensagens SET lida = 1
            WHERE remetente_id = ? AND destinatario_id = ? AND lida = 0
        `).run(usuarioId, req.usuario.id);

        // Buscar mensagens
        const mensagens = db.prepare(`
            SELECT m.id, m.remetente_id, m.mensagem, m.lida, m.criado_em,
                   u.nome as remetente_nome
            FROM mensagens m
            JOIN usuarios u ON m.remetente_id = u.id
            WHERE (m.remetente_id = ? AND m.destinatario_id = ?)
               OR (m.remetente_id = ? AND m.destinatario_id = ?)
            ORDER BY m.criado_em ASC
        `).all(req.usuario.id, usuarioId, usuarioId, req.usuario.id);

        res.json(mensagens);
    } catch (erro) {
        console.error("Erro ao buscar mensagens:", erro);
        res.status(500).json({ erro: "Erro ao buscar mensagens." });
    }
});

// ===== ROTAS ADMIN =====

// Login do administrador
app.post("/api/admin/login", (req, res) => {
    try {
        const { matricula, senha } = req.body;

        if (!matricula?.trim() || !senha) {
            return res.status(400).json({ erro: "Matrícula e senha são obrigatórios." });
        }

        const usuario = db.prepare("SELECT * FROM usuarios WHERE matricula = ? AND tipo = 'admin'").get(matricula.trim());
        if (!usuario || usuario.senha !== senha) {
            return res.status(401).json({ erro: "Credenciais de administrador inválidas." });
        }

        // Criar nova sessão
        const token = gerarToken();
        const expiraEm = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        db.prepare("INSERT INTO sessoes (usuario_id, token, expira_em) VALUES (?, ?, ?)").run(usuario.id, token, expiraEm);

        res.json({
            mensagem: "Login admin realizado!",
            token,
            usuario: {
                id: usuario.id,
                nome: usuario.nome,
                matricula: usuario.matricula,
                tipo: usuario.tipo
            }
        });
    } catch (erro) {
        console.error("Erro no login admin:", erro);
        res.status(500).json({ erro: "Erro interno ao realizar login admin." });
    }
});

// Estatísticas do dashboard
app.get("/api/admin/estatisticas", authMiddleware, adminMiddleware, (req, res) => {
    try {
        const totalAlunos = db.prepare("SELECT COUNT(*) as total FROM usuarios WHERE tipo = 'aluno'").get().total;
        const totalProfessores = db.prepare("SELECT COUNT(*) as total FROM usuarios WHERE tipo = 'professor'").get().total;
        const totalUsuarios = db.prepare("SELECT COUNT(*) as total FROM usuarios WHERE tipo != 'admin'").get().total;
        const totalConexoes = db.prepare("SELECT COUNT(*) as total FROM conexoes WHERE status = 'aceita'").get().total;
        const totalPendentes = db.prepare("SELECT COUNT(*) as total FROM conexoes WHERE status = 'pendente'").get().total;

        res.json({
            totalAlunos,
            totalProfessores,
            totalUsuarios,
            totalConexoes,
            totalPendentes
        });
    } catch (erro) {
        console.error("Erro ao buscar estatísticas:", erro);
        res.status(500).json({ erro: "Erro ao buscar estatísticas." });
    }
});

// Listar todos os usuários (admin)
app.get("/api/admin/usuarios", authMiddleware, adminMiddleware, (req, res) => {
    try {
        const { tipo } = req.query;
        let query = "SELECT id, nome, matricula, curso, tipo, criado_em FROM usuarios WHERE tipo != 'admin'";
        const params = [];

        if (tipo && ['aluno', 'professor'].includes(tipo)) {
            query += " AND tipo = ?";
            params.push(tipo);
        }

        query += " ORDER BY criado_em DESC";
        const usuarios = db.prepare(query).all(...params);

        res.json(usuarios);
    } catch (erro) {
        console.error("Erro ao listar usuários admin:", erro);
        res.status(500).json({ erro: "Erro ao listar usuários." });
    }
});

// Cadastrar usuário (admin cria matrícula de aluno ou professor)
app.post("/api/admin/usuarios", authMiddleware, adminMiddleware, (req, res) => {
    try {
        const { nome, matricula, curso, senha, tipo } = req.body;

        if (!nome?.trim() || !matricula?.trim() || !senha || !tipo) {
            return res.status(400).json({ erro: "Preencha todos os campos obrigatórios." });
        }

        if (!['aluno', 'professor'].includes(tipo)) {
            return res.status(400).json({ erro: "Tipo inválido. Use 'aluno' ou 'professor'." });
        }

        if (senha.length < 4) {
            return res.status(400).json({ erro: "A senha precisa ter pelo menos 4 caracteres." });
        }

        // Verificar se matrícula já existe
        const existente = db.prepare("SELECT id FROM usuarios WHERE matricula = ?").get(matricula.trim());
        if (existente) {
            return res.status(409).json({ erro: "Esta matrícula já está cadastrada." });
        }

        // Inserir usuário
        const resultado = db.prepare(`
            INSERT INTO usuarios (nome, matricula, curso, senha, tipo)
            VALUES (?, ?, ?, ?, ?)
        `).run(nome.trim(), matricula.trim(), curso || "", senha, tipo);

        res.status(201).json({
            mensagem: `${tipo === 'aluno' ? 'Aluno' : 'Professor'} cadastrado com sucesso!`,
            usuario: {
                id: resultado.lastInsertRowid,
                nome: nome.trim(),
                matricula: matricula.trim(),
                curso: curso || "",
                tipo
            }
        });
    } catch (erro) {
        console.error("Erro ao cadastrar usuário admin:", erro);
        res.status(500).json({ erro: "Erro interno ao cadastrar usuário." });
    }
});

// Editar usuário
app.put("/api/admin/usuarios/:id", authMiddleware, adminMiddleware, (req, res) => {
    try {
        const { id } = req.params;
        const { nome, matricula, curso, senha, tipo } = req.body;

        const usuario = db.prepare("SELECT * FROM usuarios WHERE id = ?").get(id);
        if (!usuario) {
            return res.status(404).json({ erro: "Usuário não encontrado." });
        }

        if (usuario.tipo === 'admin') {
            return res.status(403).json({ erro: "Não é possível editar administradores." });
        }

        const updates = [];
        const params = [];

        if (nome?.trim()) {
            updates.push("nome = ?");
            params.push(nome.trim());
        }
        if (matricula?.trim()) {
            // Verificar se matrícula já existe (exceto a do próprio usuário)
            const existente = db.prepare("SELECT id FROM usuarios WHERE matricula = ? AND id != ?").get(matricula.trim(), id);
            if (existente) {
                return res.status(409).json({ erro: "Esta matrícula já está em uso." });
            }
            updates.push("matricula = ?");
            params.push(matricula.trim());
        }
        if (curso !== undefined) {
            updates.push("curso = ?");
            params.push(curso);
        }
        if (senha) {
            if (senha.length < 4) {
                return res.status(400).json({ erro: "A senha precisa ter pelo menos 4 caracteres." });
            }
            updates.push("senha = ?");
            params.push(senha);
        }
        if (tipo && ['aluno', 'professor'].includes(tipo)) {
            updates.push("tipo = ?");
            params.push(tipo);
        }

        if (updates.length === 0) {
            return res.status(400).json({ erro: "Nenhum campo para atualizar." });
        }

        updates.push("atualizado_em = datetime('now')");
        params.push(id);

        db.prepare(`UPDATE usuarios SET ${updates.join(", ")} WHERE id = ?`).run(...params);

        res.json({ mensagem: "Usuário atualizado com sucesso!" });
    } catch (erro) {
        console.error("Erro ao editar usuário:", erro);
        res.status(500).json({ erro: "Erro ao editar usuário." });
    }
});

// Excluir usuário
app.delete("/api/admin/usuarios/:id", authMiddleware, adminMiddleware, (req, res) => {
    try {
        const { id } = req.params;

        const usuario = db.prepare("SELECT * FROM usuarios WHERE id = ?").get(id);
        if (!usuario) {
            return res.status(404).json({ erro: "Usuário não encontrado." });
        }

        if (usuario.tipo === 'admin') {
            return res.status(403).json({ erro: "Não é possível excluir administradores." });
        }

        // Excluir sessões e conexões do usuário (CASCADE deve cuidar disso)
        db.prepare("DELETE FROM usuarios WHERE id = ?").run(id);

        res.json({ mensagem: "Usuário excluído com sucesso!" });
    } catch (erro) {
        console.error("Erro ao excluir usuário:", erro);
        res.status(500).json({ erro: "Erro ao excluir usuário." });
    }
});

// Listar matrículas ativas (para testar login)
app.get("/api/admin/matriculas", authMiddleware, adminMiddleware, (req, res) => {
    try {
        const matriculas = db.prepare(`
            SELECT id, nome, matricula, tipo, curso, senha
            FROM usuarios
            WHERE tipo IN ('aluno', 'professor')
            ORDER BY tipo, nome ASC
        `).all();

        res.json(matriculas);
    } catch (erro) {
        console.error("Erro ao listar matrículas:", erro);
        res.status(500).json({ erro: "Erro ao listar matrículas." });
    }
});

// ===== INICIAR SERVIDOR =====

app.listen(PORT, () => {
    console.log(`🚀 Servidor ConexãoPro rodando em http://localhost:${PORT}`);
    console.log(`📦 Banco de dados SQLite conectado`);
});

