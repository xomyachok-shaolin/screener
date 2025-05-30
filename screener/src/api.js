export const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:22022'

// Общая функция-обёртка для fetch
async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, options)

  // если код ошибки
  if (!res.ok) {
    let errMsg = res.statusText
    try {
      const json = await res.json()
      errMsg = json.error || JSON.stringify(json)
    } catch (_) {}
    throw new Error(errMsg)
  }

  // если 204 No Content
  if (res.status === 204) return null

  // парсим JSON автоматически
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) {
    return res.json()
  }
  return res
}

// Функции для тегов
// Получение тегов
export const fetchTagst = () => request('/tags')

// Сохранение нового тега
export const createTagt = tag =>
  request('/tags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tag)
  })

// Обновление тега по id
export const updateTagt = (id, tag) =>
  request(`/tags/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tag)
  })

// Удаление тега по id
export const deleteTagt = id =>
  request(`/tags/${id}`, {
    method: 'DELETE'
  })


// Функции для видео
// Получение видео
export const fetchVideost = () => request('/videos')

// Загрузка видео
export const uploadVideot = (file, name) => {
  const form = new FormData()
  form.append('file', file)
  form.append('name', name)

  return request('/videos', {
    method: 'POST',
    body: form
  })
}

// Обновление видео по id
export const updateVideot = (id, video) =>
  request(`/videos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(video)
  })

// Удаление видео по id
export const deleteVideot = id =>
  request(`/videos/${id}`, {
    method: 'DELETE'
  })

// Получение тегов, относящихся к конкретному видео
export const fetchTagsForVideo = videoId =>
  request(`/videos/${videoId}/tags`)

export async function generateTags(videoId) {
  const resp = await fetch(`${API_BASE}/videos/${videoId}/generate-tags`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${resp.status}`);
  }

  // Приходим либо { status: 'done', tags: [...] }
  return resp.json();
}
