-- CreateTable
CREATE TABLE "Cliente" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "telefone" VARCHAR(15),
    "email" VARCHAR(254),
    "proximoCodigoEquipamento" INTEGER NOT NULL DEFAULT 1,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id"),
    -- RN07 / RF04: ao menos um contato obrigatório (garantia também no banco)
    CONSTRAINT "Cliente_contato_obrigatorio_check"
        CHECK ("telefone" IS NOT NULL OR "email" IS NOT NULL)
);

-- CreateTable
CREATE TABLE "Equipamento" (
    "clienteId" INTEGER NOT NULL,
    "codigoInterno" INTEGER NOT NULL,
    "tipo" VARCHAR(60) NOT NULL,
    "marca" VARCHAR(60),
    "modelo" VARCHAR(80),
    "numeroSerie" VARCHAR(80),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER NOT NULL,

    -- Entidade fraca: chave composta (cliente dono + chave parcial)
    CONSTRAINT "Equipamento_pkey" PRIMARY KEY ("clienteId","codigoInterno")
);

-- CreateIndex
CREATE INDEX "Cliente_nome_idx" ON "Cliente"("nome");

-- CreateIndex
CREATE INDEX "Cliente_telefone_idx" ON "Cliente"("telefone");

-- CreateIndex
CREATE INDEX "Cliente_email_idx" ON "Cliente"("email");

-- AddForeignKey (RN20: cliente com equipamento não pode ser excluído)
ALTER TABLE "Equipamento" ADD CONSTRAINT "Equipamento_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
