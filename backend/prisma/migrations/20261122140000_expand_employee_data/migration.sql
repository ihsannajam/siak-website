-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "academic_title" TEXT,
ADD COLUMN     "active_status" TEXT NOT NULL DEFAULT 'AKTIF',
ADD COLUMN     "additional_duties" TEXT,
ADD COLUMN     "appointment_decree_number" TEXT,
ADD COLUMN     "graduation_year" INTEGER,
ADD COLUMN     "institution_name" TEXT,
ADD COLUMN     "last_education" TEXT,
ADD COLUMN     "marital_status" TEXT,
ADD COLUMN     "personnel_category" TEXT,
ADD COLUMN     "religion" TEXT,
ADD COLUMN     "study_program" TEXT,
ADD COLUMN     "work_start_date" DATE;

-- CreateTable
CREATE TABLE "employee_trainings" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizer" TEXT,
    "year" INTEGER,
    "certificate_number" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "employee_trainings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_trainings_employee_id_idx" ON "employee_trainings"("employee_id");

-- AddForeignKey
ALTER TABLE "employee_trainings" ADD CONSTRAINT "employee_trainings_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

