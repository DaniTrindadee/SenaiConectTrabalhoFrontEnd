const { conectar, getDb } = require("./database");

// Inicializar o banco de dados
const db = conectar();
console.log("✅ Banco de dados conectado com sucesso!");

// Verificar se as tabelas foram criadas
const tabelas = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
`).all();

console.log(`\n📊 Tabelas criadas (${tabelas.length}):`);
tabelas.forEach(t => console.log(`   - ${t.name}`));

// Testar inserção de usuário
console.log("\n🧪 Testando cadastro de usuário...");
const resultado = db.prepare(`
    INSERT INTO usuarios (nome, matricula, curso, senha)
    VALUES ('Usuário Teste', '12345', 'Programador Frontend', 'test123')
`).run();
console.log(`   ✅ Usuário criado com ID: ${resultado.lastInsertRowid}`);

// Testar leitura
const usuario = db.prepare("SELECT * FROM usuarios WHERE id = ?").get(resultado.lastInsertRowid);
console.log(`   📋 Dados: ${usuario.nome} - ${usuario.matricula} - ${usuario.curso}`);

// Testar sessão
console.log("\n🧪 Testando criação de sessão...");
const token = require("uuid").v4();
const expiraEm = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
db.prepare("INSERT INTO sessoes (usuario_id, token, expira_em) VALUES (?, ?, ?)").run(usuario.id, token, expiraEm);
console.log(`   ✅ Sessão criada com token: ${token.substring(0, 8)}...`);

// Testar conexão
console.log("\n🧪 Testando conexão entre usuários...");
db.prepare("INSERT INTO usuarios (nome, matricula, curso, senha) VALUES (?, ?, ?, ?)").run("Outro Usuário", "67890", "Programador Backend", "test456");
const usuario2 = db.prepare("SELECT id FROM usuarios WHERE matricula = ?").get("67890");
db.prepare("INSERT INTO conexoes (solicitante_id, destinatario_id, status) VALUES (?, ?, 'aceita')").run(usuario.id, usuario2.id);
console.log(`   ✅ Conexão criada entre usuário ${usuario.id} e ${usuario2.id}`);

// Verificar conexões
const conexoes = db.prepare(`
    SELECT c.id, u.nome, u.curso, c.status
    FROM conexoes c
    JOIN usuarios u ON (CASE WHEN c.solicitante_id = ? THEN c.destinatario_id ELSE c.solicitante_id END) = u.id
    WHERE (c.solicitante_id = ? OR c.destinatario_id = ?) AND c.status = 'aceita'
`).all(usuario.id, usuario.id, usuario.id);
console.log(`   📋 Conexões do usuário: ${conexoes.length}`);
conexoes.forEach(c => console.log(`      - ${c.nome} (${c.curso}) - ${c.status}`));

// Limpar dados de teste
db.prepare("DELETE FROM conexoes").run();
db.prepare("DELETE FROM sessoes").run();
db.prepare("DELETE FROM usuarios").run();
console.log("\n🧹 Dados de teste limpos.");

console.log("\n🎉 Todos os testes passaram! O banco de dados está funcionando corretamente.");

// Fechar conexão
db.close();
