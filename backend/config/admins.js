// Contas com permissão de administrador — podem deletar qualquer conteúdo
// (posts, comentários, eventos, etc.), não só os próprios.
const ADMIN_EMAILS = ['g024c1025@g.neec.ac.jp'];

function isAdminEmail(email) {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}

module.exports = { ADMIN_EMAILS, isAdminEmail };
