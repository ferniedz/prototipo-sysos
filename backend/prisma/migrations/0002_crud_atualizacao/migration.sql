-- CRUD de clientes e equipamentos (PB18): registro de quem corrigiu e quando
-- (RN22). Colunas opcionais: nulas até a primeira alteração, então registros
-- existentes continuam válidos sem preenchimento retroativo.

-- AlterTable
ALTER TABLE "Cliente"
    ADD COLUMN "atualizadoEm" TIMESTAMP(3),
    ADD COLUMN "atualizadoPorId" INTEGER;

-- AlterTable
ALTER TABLE "Equipamento"
    ADD COLUMN "atualizadoEm" TIMESTAMP(3),
    ADD COLUMN "atualizadoPorId" INTEGER;
