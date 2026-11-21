import { AppError } from './erros';

/** Erros de negócio da ordem de serviço (mensagens seguras para a API). */
export const errosOs = {
  ordemNaoEncontrada: () =>
    new AppError(404, 'ORDEM_SERVICO_NAO_ENCONTRADA', 'Ordem de serviço não encontrada.'),
  // RF11 / RN06: avisa e mostra a OS existente. Não bloqueia: exige confirmação.
  equipamentoComOsEmAberto: (ordensEmAberto: unknown) =>
    new AppError(
      409,
      'EQUIPAMENTO_COM_OS_EM_ABERTO',
      'Este equipamento já possui ordem de serviço em aberto. Confira a OS existente ' +
        'e, se for realmente uma nova ordem, repita com confirmarOsEmAberto=true.',
      { ordensEmAberto },
    ),
};