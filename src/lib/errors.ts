// Extrait un message d'erreur lisible, même si l'objet n'est pas une instance d'Error
// (ex: certains wrappers/devtools clonent l'objet et perdent le prototype Error).
export function extractErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message
  if (err && typeof err === 'object' && 'message' in err) {
    const message = (err as { message?: unknown }).message
    if (typeof message === 'string' && message.length > 0) return message
  }
  return fallback
}
