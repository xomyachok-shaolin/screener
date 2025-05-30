// Импорт библиотек
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const { spawn } = require('child_process');

const PYTHON_BIN = '/opt/2024.02/anaconda3/envs/ml/bin/python';

const app = express();
const PORT = 22022;

app.use(cors());
app.use(bodyParser.json());

// Пути к файлам данных
const tagsFilePath = path.join(__dirname, 'tags.json');
const videosFilePath = path.join(__dirname, 'videos.json');

// Создаём папку uploads
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const generatedTagsDir = path.join(__dirname, 'generated_tags');
if (!fs.existsSync(generatedTagsDir)) fs.mkdirSync(generatedTagsDir);

// Настройка хранилища multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = uuidv4() + ext;
    cb(null, filename);
  }
});
const upload = multer({ storage });
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File size limit exceeded' });
  }
  next(err);
});


// Раздаем папку uploads статическиs
app.use('/uploads', express.static(uploadsDir));

// Вспомогательные функции для тегов
const readTagsFromFile = () => {
  try {
    if (!fs.existsSync(tagsFilePath)) {
      fs.writeFileSync(tagsFilePath, JSON.stringify([]));
    }
    const data = fs.readFileSync(tagsFilePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Ошибка чтения файла тегов:', err);
    return [];
  }
};

const writeTagsToFile = (tags) => {
  fs.writeFileSync(tagsFilePath, JSON.stringify(tags, null, 2));
};

// Вспомогательные функции для видео
const readVideosFromFile = () => {
  try {
    if (!fs.existsSync(videosFilePath)) {
      fs.writeFileSync(videosFilePath, JSON.stringify([]));
    }
    const data = fs.readFileSync(videosFilePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Ошибка чтения файла видео:', err);
    return [];
  }
};

const writeVideosToFile = (videos) => {
  fs.writeFileSync(videosFilePath, JSON.stringify(videos, null, 2));
};

// Настройки Swagger
const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'Video Tagging API',
      version: '1.0.0',
      description: 'API для управления видео и тегами',
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
      },
    ],
  },
  apis: ['./server.js'], // Файл с аннотациями для Swagger
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

/**
 * @swagger
 * components:
 *   schemas:
 *     Tag:
 *       type: object
 *       required:
 *         - name
 *         - timeIntervalstart
 *         - timeIntervalend
 *         - videoId
 *         - color
 *       properties:
 *         id:
 *           type: string
 *           description: Уникальный идентификатор тега
 *         name:
 *           type: string
 *           description: Название тега
 *         color:
 *           type: string
 *           description: Цвет тега
 *         description:
 *           type: string
 *           description: Описание тега
 *         timeIntervalstart:
 *           type: string
 *           description: Начало временного отрезка, к которому относится тег (например, "00:00:12,048")
 *         timeIntervalend:
 *           type: string
 *           description: Конец временного отрезка, к которому относится тег (например, "00:00:17,048")
 *         videoId:
 *           type: string
 *           description: ID видео, к которому относится тег
 *
 *     Video:
 *       type: object
 *       required:
 *         - name
 *         - path
 *       properties:
 *         id:
 *           type: string
 *           description: Уникальный идентификатор видео
 *         name:
 *           type: string
 *           description: Название видео
 *         path:
 *           type: string
 *           description: Локальный путь или URL видео
 */

/**
 * @swagger
 * tags:
 *   - name: Tags
 *     description: API для управления тегами
 *   - name: Videos
 *     description: API для управления видео
 */

/////////////////////////
// Маршруты для тегов  //
/////////////////////////

/**
 * @swagger
 * /tags:
 *   get:
 *     summary: Получение всех тегов
 *     tags: [Tags]
 *     responses:
 *       200:
 *         description: Список (массив) тегов
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Tag'
 */
app.get('/tags', (req, res) => {
  const tags = readTagsFromFile();
  res.json(tags);
});

/**
 * @swagger
 * /tags:
 *   post:
 *     summary: Создание нового тега
 *     tags: [Tags]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Tag'
 *     responses:
 *       201:
 *         description: Тег создан
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Tag'
 *       400:
 *         description: Неверные данные
 */
app.post('/tags', (req, res) => {
  let tags = readTagsFromFile();
  const { name, color, description, timeIntervalstart, timeIntervalend, videoId } = req.body;
  if (!timeIntervalstart || !name) {
    return res.status(400).json({ error: 'Необходимо указать начало временного отрезка и название тега.' });
  }
  if (!timeIntervalend || !name) {
    return res.status(400).json({ error: 'Необходимо указать конец временного отрезка и название тега.' });
  }
  if (!videoId) {
    return res.status(400).json({ error: 'Необходимо указать ID видео, к которому относится тег.' });
  }
  if (!color) {
    return res.status(400).json({ error: 'Необходимо указать цвет тега.' });
  }

  const newTag = {
    id: uuidv4(),
    name,
    color,
    description: description || '',
    timeIntervalstart,
    timeIntervalend,
    videoId
  };
  tags.push(newTag);
  writeTagsToFile(tags);
  res.status(201).json(newTag);
});

/**
 * @swagger
 * /tags/{id}:
 *   put:
 *     summary: Обновление существующего тега
 *     tags: [Tags]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID тега
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Tag'
 *     responses:
 *       200:
 *         description: Тег обновлен
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Tag'
 *       404:
 *         description: Тег не найден
 */
app.put('/tags/:id', (req, res) => {
  let tags = readTagsFromFile();
  const tagId = req.params.id;
  const { name, color, description, timeIntervalstart, timeIntervalend, videoId } = req.body;
  const tagIndex = tags.findIndex(tag => tag.id === tagId);
  if (tagIndex === -1) {
    return res.status(404).json({ error: 'Тег не найден.' });
  }
  const updatedTag = {
    id: tagId,
    name: name || tags[tagIndex].name,
    color: color || tags[tagIndex].color,
    description: description !== undefined ? description : tags[tagIndex].description,
    timeIntervalstart: timeIntervalstart || tags[tagIndex].timeIntervalstart,
    timeIntervalend: timeIntervalend || tags[tagIndex].timeIntervalend,
    videoId: videoId || tags[tagIndex].videoId
  };
  tags[tagIndex] = updatedTag;
  writeTagsToFile(tags);
  res.json(updatedTag);
});

/**
 * @swagger
 * /tags/{id}:
 *   delete:
 *     summary: Удаление тега
 *     tags: [Tags]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID тега
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Тег удален
 *       404:
 *         description: Тег не найден
 */

app.delete('/tags/:id', (req, res) => {
  let tags = readTagsFromFile();
  const tagId = req.params.id;
  const tagIndex = tags.findIndex(tag => tag.id === tagId);
  if (tagIndex === -1) {
    return res.status(404).json({ error: 'Тег не найден.' });
  }
  tags.splice(tagIndex, 1);
  writeTagsToFile(tags);
  res.status(204).send();
});


/////////////////////////
// Маршруты для видео  //
/////////////////////////

/**
 * @swagger
 * /videos:
 *   get:
 *     summary: Получение всех видео
 *     tags: [Videos]
 *     responses:
 *       200:
 *         description: Список видео
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Video'
 */
 app.get('/videos', (req, res) => {
  const videos = readVideosFromFile();
  res.json(videos);
});

/**
 * @swagger
 * /videos:
 *   post:
 *     summary: Добавление нового видео (загрузка файла)
 *     tags: [Videos]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Видео добавлено
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Video'
 *       400:
 *         description: Отсутствует файл или название
 */
app.post('/videos', upload.single('file'), (req, res) => {
  console.log('=== POST /videos ===');
  console.log('req.file:', req.file);
  console.log('req.body:', req.body);
  try {
    let videos = readVideosFromFile();
    const file = req.file;
    const { name } = req.body;

    if (!file) {
      console.warn('No file in request');
      return res.status(400).json({ error: 'Не выбран файл.' });
    }
    if (!name) {
      console.warn('No name in body');
      return res.status(400).json({ error: 'Необходимо указать название.' });
    }

    const newVideo = {
      id: uuidv4(),
      name,
      path: `/uploads/${file.filename}`
    };
    videos.push(newVideo);
    writeVideosToFile(videos);
    console.log('Saved video:', newVideo);
    res.status(201).json(newVideo);

  } catch (err) {
    console.error('Error in POST /videos:', err);
    res.status(500).json({ error: err.message });
  }
});


/**
 * @swagger
 * /videos/{id}:
 *   put:
 *     summary: Обновление существующего видео
 *     tags: [Videos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Video'
 *     responses:
 *       200:
 *         description: Видео обновлено
 *       404:
 *         description: Видео не найдено
 */
app.put('/videos/:id', (req, res) => {
  let videos = readVideosFromFile();
  const videoId = req.params.id;
  const { name, path: videoPath } = req.body;
  const videoIndex = videos.findIndex(video => video.id === videoId);
  if (videoIndex === -1) {
    return res.status(404).json({ error: 'Видео не найдено.' });
  }
  const updatedVideo = {
    id: videoId,
    name: name || videos[videoIndex].name,
    path: videoPath || videos[videoIndex].path
  };
  videos[videoIndex] = updatedVideo;
  writeVideosToFile(videos);
  res.json(updatedVideo);
});

/**
 * @swagger
 * /videos/{id}:
 *   delete:
 *     summary: Удаление видео
 *     tags: [Videos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Видео удалено
 *       404:
 *         description: Видео не найдено
 */
app.delete('/videos/:id', (req, res) => {
  let videos = readVideosFromFile();
  const videoId = req.params.id;
  const videoIndex = videos.findIndex(video => video.id === videoId);
  if (videoIndex === -1) {
    return res.status(404).json({ error: 'Видео не найдено.' });
  }
  const videoPath = path.join(__dirname, 'uploads', videos[videoIndex].path.split('/uploads/')[1]);
  if (fs.existsSync(videoPath)) {
    fs.unlinkSync(videoPath); // удаляем файл
  }
  videos.splice(videoIndex, 1);
  writeVideosToFile(videos);
  res.status(204).send();
});

/**
 * POST /videos/:id/generate-tags
 * — Запуск python-скрипта и возвращение клиенту JSON с тегами
 */
 app.post('/videos/:id/generate-tags', (req, res) => {
  // Проверка, что видео существует
  const videos = readVideosFromFile();
  const videoId = req.params.id;
  const video = videos.find(v => v.id === videoId);
  if (!video) {
    return res.status(404).json({ error: 'Видео не найдено' });
  }

  // Составление полного пути к файлу
  // предположив, что в video.path хранятся относительные пути вида "/uploads/abc.mp4"
  const filename = path.basename(video.path);
  const videoPath = path.join(uploadsDir, filename);

  // Задаём имя выходного файла для тегов
  const outFile = path.join(generatedTagsDir, `${videoId}.json`);

  // Запуск скрипта
  const py = spawn(
    PYTHON_BIN,
    [
      path.join(__dirname, 'generate_tags.py'),
      '--video-path', videoPath,
      '--out-file',   outFile
    ],
    { stdio: ['ignore','pipe','pipe'] }
  );
  
  let stderr = '';
  py.stderr.on('data', data => {
    stderr += data.toString();
  });

  // Когда дочерний процесс завершится
  py.on('close', code => {
    if (code !== 0) {
      console.error('generate_tags.py failed:', stderr);
      return res.status(500).json({
        error: 'Ошибка в генерации тегов',
        details: stderr.slice(0, 200)  // обрезаем длинные логи
      });
    }

    // Читаем результат из outFile
    try {
      const tags = JSON.parse(fs.readFileSync(outFile, 'utf8'));
      return res.json({ status: 'done', tags });
    } catch (err) {
      console.error('Не удалось прочитать outFile:', err);
      return res.status(500).json({ error: 'Не удалось прочитать результат генерации' });
    }
  });

  //    Пока ждем — можем сразу ответить, что задача запущена
  //    (если хотим, чтобы клиент сразу получил что-то)
  //    ВАЖНО: в таком случае мы не сможем потом повторно отправить ответ.
  //    Поэтому закомментировано:
  // res.status(202).json({ status: 'processing' });
});

// OPTIONS – для CORS
app.options('/tags', (req, res) => {
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.send();
});

// Oбработка предзапроса CORS
app.options('*', cors());

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
  console.log(`Swagger: http://localhost:${PORT}/api-docs`);
});

////////////////////////////////////////////////////////////////////////
// Дополнительный маршрут для видео: получение тегов выбранного видео //
////////////////////////////////////////////////////////////////////////

/**
 * @swagger
 * /videos/{id}/tags:
 *   get:
 *     summary: Получение тегов, относящихся к указанному видео
 *     tags: [Tags]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID видео, для которого нужны теги
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Список тегов для выбранного видео
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Tag'
 *       404:
 *         description: Видео не найдено
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Видео не найдено"
 */
 app.get('/videos/:id/tags', (req, res) => {
  const videoId = req.params.id;
  
  // Сначала проверяем, существует ли видео с таким ID
  const videos = readVideosFromFile();
  const video = videos.find(v => v.id === videoId);
  if (!video) {
    return res.status(404).json({ error: 'Видео не найдено' });
  }
  
  // Если видео найдено, то ищем теги для него
  const tags = readTagsFromFile();
  const filteredTags = tags.filter(tag => tag.videoId === videoId);
  res.json(filteredTags);
});

