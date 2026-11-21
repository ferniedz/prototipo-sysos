-- CreateTable
CREATE TABLE "OrdemServico" (
    "numero" SERIAL NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "equipamentoCodigoInterno" INTEGER NOT NULL,
    "problemaRelatado" VARCHAR(1000) NOT NULL,
    "status" VARCHAR(40) NOT NULL DEFAULT 'Aguardando Diagnóstico',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER NOT NULL,

    -- RN03: o número é a chave primária (único, gerado por sequência, nunca muda)
    CONSTRAINT "OrdemServico_pkey" PRIMARY KEY ("numero"),
    -- RN02: problema relatado obrigatório (não aceita só espaços)
    CONSTRAINT "OrdemServico_problema_obrigatorio_check"
        CHECK (length(btrim("problemaRelatado")) > 0)
);

-- CreateIndex
CREATE INDEX "OrdemServico_clienteId_status_idx" ON "OrdemServico"("clienteId", "status");

-- CreateIndex
CREATE INDEX "OrdemServico_status_idx" ON "OrdemServico"("status");

-- CreateIndex
CREATE INDEX "OrdemServico_clienteId_equipamentoCodigoInterno_idx"
    ON "OrdemServico"("clienteId", "equipamentoCodigoInterno");

-- AddForeignKey (RN01 + RN20: equipamento e cliente com OS não podem ser excluídos)
ALTER TABLE "OrdemServico" ADD CONSTRAINT "OrdemServico_clienteId_equipamentoCodigoInterno_fkey"
    FOREIGN KEY ("clienteId", "equipamentoCodigoInterno")
    REFERENCES "Equipamento"("clienteId", "codigoInterno") ON DELETE RESTRICT ON UPDATE RESTRICT;