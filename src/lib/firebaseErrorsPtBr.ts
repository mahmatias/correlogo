const FIREBASE_ERRORS_PT: Record<string, string> = {
  'auth/invalid-email': 'Email inválido.',
  'auth/user-disabled': 'Esta conta foi desativada.',
  'auth/user-not-found': 'Usuário não encontrado.',
  'auth/wrong-password': 'Senha incorreta.',
  'auth/invalid-credential': 'Email ou senha incorretos.',
  'auth/email-already-in-use': 'Este email já está cadastrado.',
  'auth/weak-password': 'A senha deve ter pelo menos 6 caracteres.',
  'auth/operation-not-allowed': 'Este método de login não está habilitado.',
  'auth/popup-closed-by-user': 'Login cancelado. Tente novamente.',
  'auth/network-request-failed': 'Sem conexão com a internet. Verifique sua rede.',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde um momento e tente novamente.',
  'auth/requires-recent-login': 'Faça login novamente para continuar.',
  'auth/expired-action-code': 'O link de redefinição expirou.',
  'auth/invalid-action-code': 'O link de redefinição é inválido.',
};

export const getFirebaseErrorPt = (error: any): string => {
  if (error?.code && FIREBASE_ERRORS_PT[error.code]) {
    return FIREBASE_ERRORS_PT[error.code];
  }
  if (error?.message) {
    return error.message;
  }
  return 'Erro desconhecido. Tente novamente.';
};
