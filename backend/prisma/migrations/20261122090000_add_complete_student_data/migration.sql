-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StudentStatus" ADD VALUE 'NONAKTIF';
ALTER TYPE "StudentStatus" ADD VALUE 'MENGUNDURKAN_DIRI';

-- AlterTable
ALTER TABLE "students" ADD COLUMN     "admission_class_id" TEXT,
ADD COLUMN     "admission_type" TEXT,
ADD COLUMN     "adopted_siblings_count" INTEGER,
ADD COLUMN     "child_order" INTEGER,
ADD COLUMN     "child_status" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "daily_language" TEXT,
ADD COLUMN     "distance_to_school_km" DOUBLE PRECISION,
ADD COLUMN     "district" TEXT,
ADD COLUMN     "education_program" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "entry_academic_year_id" TEXT,
ADD COLUMN     "living_with" TEXT,
ADD COLUMN     "nationality" TEXT,
ADD COLUMN     "nickname" TEXT,
ADD COLUMN     "nik" TEXT,
ADD COLUMN     "postal_code" TEXT,
ADD COLUMN     "province" TEXT,
ADD COLUMN     "registration_date" TIMESTAMP(3),
ADD COLUMN     "registration_number" TEXT,
ADD COLUMN     "religion" TEXT,
ADD COLUMN     "siblings_count" INTEGER,
ADD COLUMN     "start_study_date" TIMESTAMP(3),
ADD COLUMN     "step_siblings_count" INTEGER,
ADD COLUMN     "village" TEXT;

-- AlterTable
ALTER TABLE "student_families" ADD COLUMN     "father_address" TEXT,
ADD COLUMN     "father_birth_date" TIMESTAMP(3),
ADD COLUMN     "father_birth_place" TEXT,
ADD COLUMN     "father_death_year" INTEGER,
ADD COLUMN     "father_education" TEXT,
ADD COLUMN     "father_email" TEXT,
ADD COLUMN     "father_income" INTEGER,
ADD COLUMN     "father_life_status" TEXT,
ADD COLUMN     "father_nationality" TEXT,
ADD COLUMN     "father_nik" TEXT,
ADD COLUMN     "father_religion" TEXT,
ADD COLUMN     "guardian_birth_date" TIMESTAMP(3),
ADD COLUMN     "guardian_birth_place" TEXT,
ADD COLUMN     "guardian_education" TEXT,
ADD COLUMN     "guardian_email" TEXT,
ADD COLUMN     "guardian_income" INTEGER,
ADD COLUMN     "guardian_job" TEXT,
ADD COLUMN     "guardian_nik" TEXT,
ADD COLUMN     "guardian_religion" TEXT,
ADD COLUMN     "mother_address" TEXT,
ADD COLUMN     "mother_birth_date" TIMESTAMP(3),
ADD COLUMN     "mother_birth_place" TEXT,
ADD COLUMN     "mother_death_year" INTEGER,
ADD COLUMN     "mother_education" TEXT,
ADD COLUMN     "mother_email" TEXT,
ADD COLUMN     "mother_income" INTEGER,
ADD COLUMN     "mother_life_status" TEXT,
ADD COLUMN     "mother_nationality" TEXT,
ADD COLUMN     "mother_nik" TEXT,
ADD COLUMN     "mother_religion" TEXT;

-- AlterTable
ALTER TABLE "student_health_records" ADD COLUMN     "drug_allergies" TEXT,
ADD COLUMN     "food_allergies" TEXT,
ADD COLUMN     "physical_condition" TEXT,
ADD COLUMN     "special_needs" TEXT;

-- CreateTable
CREATE TABLE "student_education_histories" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "school_name" TEXT NOT NULL,
    "npsn" TEXT,
    "school_status" TEXT,
    "school_address" TEXT,
    "entry_year" INTEGER,
    "exit_year" INTEGER,
    "last_class" TEXT,
    "education_status" TEXT,
    "diploma_number" TEXT,
    "diploma_date" TIMESTAMP(3),
    "skhun_number" TEXT,
    "skhun_date" TIMESTAMP(3),
    "study_duration" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "student_education_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "student_education_histories_student_id_idx" ON "student_education_histories"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "students_nik_key" ON "students"("nik");

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_entry_academic_year_id_fkey" FOREIGN KEY ("entry_academic_year_id") REFERENCES "academic_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_admission_class_id_fkey" FOREIGN KEY ("admission_class_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_education_histories" ADD CONSTRAINT "student_education_histories_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

