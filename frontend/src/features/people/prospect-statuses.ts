// Values accepted by CK_Prospects_Status and the existing status query parameter.
export const prospectStatuses = [
  ["NEW", "Nuevos"],
  ["CONTACTED", "Contactados"],
  ["TRIAL_SCHEDULED", "Prueba programada"],
  ["QUALIFIED", "Calificados"],
  ["WON", "Convertidos"],
  ["LOST", "No continuaron"],
  ["ARCHIVED", "Archivados"],
] as const;
