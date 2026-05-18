/**
 * Wrapper for Google Drive REST API and Google Identity Services (GIS)
 */

const BACKUP_FILENAME = 'vocab-kids-backup.json'
const SCOPES = 'https://www.googleapis.com/auth/drive.file'

/**
 * Request an access token from Google using the Token Model.
 */
export function requestAccessToken() {
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: (response) => {
        if (response.error_description) {
          reject(new Error(response.error_description))
        } else if (response.access_token) {
          resolve(response.access_token)
        } else {
          reject(new Error('Unknown authentication error'))
        }
      },
      error_callback: (err) => {
        reject(err)
      }
    })
    client.requestAccessToken({ prompt: 'consent' })
  })
}

/**
 * Find the backup file in the user's Google Drive.
 */
export async function findBackupFile(accessToken) {
  const query = encodeURIComponent(`name = '${BACKUP_FILENAME}' and trashed = false`)
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`
  
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  
  if (!response.ok) throw new Error('Failed to search Google Drive')
  
  const data = await response.json()
  return data.files && data.files.length > 0 ? data.files[0] : null
}

/**
 * Download the backup file content.
 */
export async function fetchDriveData(accessToken, fileId) {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
  
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  
  if (!response.ok) throw new Error('Failed to download backup from Google Drive')
  
  return await response.json()
}

/**
 * Create or update the backup file in Google Drive.
 */
export async function uploadDriveData(accessToken, fileId, data) {
  const metadata = {
    name: BACKUP_FILENAME,
    mimeType: 'application/json'
  }
  
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  form.append('file', new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  
  let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart'
  let method = 'POST'
  
  if (fileId) {
    url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
    method = 'PATCH'
  }
  
  const response = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form
  })
  
  if (!response.ok) {
    const err = await response.json()
    throw new Error(`Failed to upload to Google Drive: ${err.error?.message || response.statusText}`)
  }
  
  return await response.json()
}

/**
 * Revoke the access token.
 */
export function revokeToken(accessToken) {
  if (accessToken) {
    google.accounts.oauth2.revoke(accessToken, () => {
      console.log('Token revoked')
    })
  }
}
