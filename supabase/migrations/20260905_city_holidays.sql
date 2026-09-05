-- =============================================
-- FichaMe - Migración: festivos por ciudad
-- No destructiva: añade columnas para recordar
-- la ciudad desde la que se importan festivos.
-- Ejecuta este script en el SQL Editor de Supabase.
-- =============================================

alter table public.kiosk_settings
  add column if not exists holiday_region text;

alter table public.kiosk_settings
  add column if not exists holiday_province text;

alter table public.kiosk_settings
  add column if not exists holiday_city text;