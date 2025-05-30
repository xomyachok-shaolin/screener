import React, { useState, useRef, useEffect } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import {
    Button, List, Layout, Checkbox, Dropdown, Menu, Slider, Tooltip, Tag,
    Input, Modal, Typography, Radio, Spin, message
} from 'antd';
import { SketchPicker } from 'react-color';
import {
    PlayCircleOutlined, PauseCircleOutlined, SoundOutlined, EllipsisOutlined,
    FullscreenOutlined, SettingOutlined, DoubleLeftOutlined, DoubleRightOutlined,
    StepForwardOutlined, StepBackwardOutlined, ZoomInOutlined, ZoomOutOutlined,
    PlusOutlined, EditOutlined, DeleteOutlined
} from '@ant-design/icons';
import { useDropzone } from 'react-dropzone';
import { fetchTagst, updateTagt, deleteTagt, uploadVideot, fetchVideost, updateVideot, deleteVideot, fetchTagsForVideo, generateTags, API_BASE, createTagt } from './api'; // импорт функций работы с API
import YouTube from 'react-youtube'; // Используем YouTube IFrame Player API

import 'antd/dist/antd.css';
import './styles/styles.css';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

// Компонент для меню настроек скорости воспроизведения и скачивания видео
const SettingsMenu = ({ onSpeedChange, currentSpeed, onDownload }) => {
    return (
        <Menu>
            <Menu.SubMenu key="speed" title="Скорость воспроизведения">
                {[0.5, 1, 1.5, 2].map((speed) => (
                    <Menu.Item key={speed} onClick={() => onSpeedChange(speed)}>
                        <span>{speed}x</span>
                        {currentSpeed === speed && <span style={{ marginLeft: '10px' }}>●</span>}
                    </Menu.Item>
                ))}
            </Menu.SubMenu>
            <Menu.Item key="download" onClick={onDownload}>
                Скачать видео
            </Menu.Item>
        </Menu>
    );
};

const hexToRgba = (hex, alpha = 1) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const VideoUploadApp = () => {
    // --- Состояния для загрузки видео и выбора метода ---
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false); // единая модалка
    const [uploadMethod, setUploadMethod] = useState('local');         // 'local' или 'url'
    const [inputUrl, setInputUrl] = useState('');
    const [videos, setVideos] = useState([]);
    const [selectedVideo, setSelectedVideo] = useState(null);

    // --- Состояния для плеера и WaveSurfer ---
    const [wavesurfer, setWavesurfer] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [showVolumeSlider, setShowVolumeSlider] = useState(false);
    const [volume, setVolume] = useState(50);
    const [currentTime, setCurrentTime] = useState('00:00');
    const [duration, setDuration] = useState('00:00');
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [scale, setScale] = useState(1);

    // --- Состояния для тегов и регионов ---
    const [isTagModalOpen, setIsTagModalOpen] = useState(false);
    const [tagName, setTagName] = useState('');
    const [tagDescription, setTagDescription] = useState('');
    const [tagColor, setTagColor] = useState('#1890ff');
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [tags, setTags] = useState([]);
    const [regions, setRegions] = useState([]);
    const [editingTag, setEditingTag] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [regionStart, setRegionStart] = useState(null);
    const [regionEnd, setRegionEnd] = useState(null);
    const [isGeneratingTags, setIsGeneratingTags] = useState(false);
    const [generatedTags, setGeneratedTags] = useState([]);          // сюда придут сгенерированные теги

    // --- Refs ---
    const videoRef = useRef(null);
    const waveRef = useRef();
    const wsRef = useRef();
    const regionsPluginRef = useRef(null);

    const [isUploading, setIsUploading] = useState(false);

    const onDrop = async (acceptedFiles) => {
        if (acceptedFiles.length === 0) return;

        setIsUploading(true);
        try {
            for (const file of acceptedFiles) {
                await uploadVideot(file, file.name);
            }
            const freshVideos = await fetchVideost();
            setVideos(freshVideos);
            message.success('Видео успешно загружены');
        } catch (err) {
            console.error(err);
            message.error('Ошибка при загрузке видео: ' + err.message);
        } finally {
            setIsUploading(false);
            setIsUploadModalOpen(false);
        }
    };

    // --- Настройка dropzone для локальной загрузки видео ---
    const { getRootProps, getInputProps } = useDropzone({
        onDrop,
        disabled: isUploading,
        accept: {
            'video/mp4': ['.mp4'],
            'video/webm': ['.webm'],
            'video/ogg': ['.ogv'],
            'video/mkv': ['.mkv'],
            'video/mov': ['.mov'],
        },
    });

    // --- Загрузка видео из URL ---
    const addVideoFromUrl = () => {
        if (!inputUrl) {
            alert("Введите URL видео");
            return;
        }

        // Проверяем, является ли это YouTube URL
        const youtubeRegex = `/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?.*v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/`;
        const matched = inputUrl.match(youtubeRegex);

        let newVideo;

        if (matched) {
            // Это YouTube URL — сохраняем только идентификатор видео
            newVideo = {
                name: `YouTube Video (${matched[1]})`,
                src: matched[1],
                type: 'youtube'
            };
        } else {
            // Обычный URL видео
            const videoName = inputUrl.split("/").pop() || "Видео по ссылке";
            newVideo = {
                name: videoName,
                src: inputUrl,
                type: 'direct'
            };
        }

        setVideos((prev) => [...prev, newVideo]);
        setInputUrl("");
        setIsUploadModalOpen(false); // Закрываем модалку после добавления
    };

    const logo = require('./images/logo4444.png');

    // при выборе видео
    const handleSelectVideo = async (video) => {
        setSelectedVideo(video);
        try {
            const tags = await fetchTagsForVideo(video.id);
            setTags(tags); // setTags — ваш useState для тегов
        } catch (e) {
            alert(e.message);
        }
    };

    // --- Полноэкранный режим ---
    const toggleFullscreen = () => {
        if (videoRef.current.requestFullscreen) {
            videoRef.current.requestFullscreen();
        } else if (videoRef.current.webkitRequestFullscreen) {
            videoRef.current.webkitRequestFullscreen();
        } else if (videoRef.current.msRequestFullscreen) {
            videoRef.current.msRequestFullscreen();
        }
    };

    // --- Меню настроек (скачивание и скорость) ---
    const handleSettingsMenuClick = (key) => {
        if (key === 'download' && selectedVideo) {
            const link = document.createElement('a');
            link.href = selectedVideo.src;
            link.download = selectedVideo.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    // --- Масштабирование видео ---
    const zoomIn = () => {
        setScale((prevScale) => Math.min(prevScale + 0.1, 2));
    };
    const zoomOut = () => {
        setScale((prevScale) => Math.max(prevScale - 0.1, 0.5));
    };

    // --- Play/Pause видео ---
    const togglePlayPause = () => {
        if (videoRef.current.paused) {
            videoRef.current.play()
                .catch(err => {
                    if (err.name !== 'AbortError') console.error(err);
                });
            setIsPlaying(true);
            if (wavesurfer && !wavesurfer.isPlaying()) {
                wavesurfer.play();
            }
        } else {
            videoRef.current.pause();
            setIsPlaying(false);
            if (wavesurfer && wavesurfer.isPlaying()) {
                wavesurfer.pause();
            }
        }
    };

    // --- Громкость ---
    const toggleVolumeSlider = () => {
        setShowVolumeSlider((prev) => !prev);
    };
    const handleVolumeChange = (value) => {
        setVolume(value);
        if (videoRef.current) {
            videoRef.current.volume = value / 100;
        }
    };

    // --- Форматирование времени (ЧЧ:ММ:СС) ---
    const formatTimeWithHours = (time) => {
        const hours = Math.floor(time / 3600)
            .toString()
            .padStart(2, '0');
        const minutes = Math.floor((time % 3600) / 60)
            .toString()
            .padStart(2, '0');
        const seconds = Math.floor(time % 60)
            .toString()
            .padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    };

    // --- Коллбэки для регионов (создание, обновление, удаление) ---
    const handleRegionCreated = (region) => {
        setRegions((prev) => [...prev, region]);
        // Если создаём регион напрямую - можно синхронизировать с тегами (логика при необходимости)
    };
    const handleRegionUpdated = (region) => {
        setRegions((prev) =>
            prev.map((r) => (r.id === region.id ? region : r))
        );
    };
    const handleRegionRemoved = (region) => {
        setRegions((prev) => prev.filter((r) => r.id !== region.id));
        if (region.data?.tagId) {
            setTags((prev) => prev.filter((tag) => tag.id !== region.data.tagId));
        }
    };

    // --- Обновление текущего времени и продолжительности ---
    const updateTime = () => {
        if (videoRef.current) {
            setCurrentTime(formatTimeWithHours(videoRef.current.currentTime));
            setDuration(formatTimeWithHours(videoRef.current.duration || 0));
        }
    };

    // --- Скорость воспроизведения ---
    const handleSpeedChange = (speed) => {
        if (videoRef.current) {
            videoRef.current.playbackRate = speed;
            setPlaybackSpeed(speed);
        }
    };

    // --- Инициализация WaveSurfer при выборе нового видео ---
    useEffect(() => {
        if (!selectedVideo) return;

        // 1) Уничтожаем старый инстанс
        wsRef.current?.destroy();

        // 2) Создаём Regions-плагин
        const regionsPlugin = RegionsPlugin.create({ dragSelection: true });
        regionsPluginRef.current = regionsPlugin;

        // 3) Создаём Wavesurfer, привязываем к <video>
        const ws = WaveSurfer.create({
            container: waveRef.current,
            backend: 'MediaElement',       // обязательно MediaElement
            media: videoRef.current,     // attach your <video> element
            waveColor: '#ddd',
            progressColor: '#2196f3',
            height: 80,
            plugins: [regionsPlugin],
        });
        wsRef.current = ws;
        setWavesurfer(ws);

        // 4) Когда элемент <video> готов, отрисуем волну
        ws.on('ready', () => {
            regionsPlugin.clearRegions();
            fetchTagsForVideo(selectedVideo.id)
                .then(apiTags => {
                    setTags(apiTags);
                    apiTags.forEach(tag => {
                        regionsPlugin.addRegion({
                            id: tag.id,
                            start: timestampToFloat(tag.timeIntervalstart),   // НЕ сокращайте → full name
                            end: timestampToFloat(tag.timeIntervalend),
                            color: hexToRgba(tag.color, 0.3),
                            data: { tagId: tag.id }
                        });
                    });
                });
        });

        // 5) Запускаем загрузку (WaveSurfer возьмёт медиа из videoRef)
        ws.load(selectedVideo.src);

        return () => ws.destroy();
    }, [selectedVideo]);


    // --- Синхронизация WaveSurfer и видео (Play/Pause/Seek) ---
    useEffect(() => {
        if (wavesurfer && videoRef.current) {
            const videoElement = videoRef.current;

            const handleVideoPlay = () => {
                if (!wavesurfer.isPlaying()) {
                    wavesurfer.play();
                    setIsPlaying(true);
                }
            };

            const handleVideoPause = () => {
                if (wavesurfer.isPlaying()) {
                    wavesurfer.pause();
                    setIsPlaying(false);
                }
            };

            const handleVideoSeek = () => {
                if (wavesurfer && videoRef.current.duration) {
                    const progress = videoRef.current.currentTime / videoRef.current.duration;
                    wavesurfer.seekTo(progress);
                }
            };

            videoElement.addEventListener('play', handleVideoPlay);
            videoElement.addEventListener('pause', handleVideoPause);
            videoElement.addEventListener('seeked', handleVideoSeek);
            videoElement.addEventListener('timeupdate', updateTime);
            videoElement.addEventListener('loadedmetadata', updateTime);

            wavesurfer.on('interaction', () => {
                if (videoRef.current && wavesurfer.getCurrentTime) {
                    videoRef.current.currentTime = wavesurfer.getCurrentTime();
                }
            });

            return () => {
                videoElement.removeEventListener('play', handleVideoPlay);
                videoElement.removeEventListener('pause', handleVideoPause);
                videoElement.removeEventListener('seeked', handleVideoSeek);
                videoElement.removeEventListener('timeupdate', updateTime);
                videoElement.removeEventListener('loadedmetadata', updateTime);
                wavesurfer.un('interaction');
            };
        }
    }, [wavesurfer]);

    // --- Компонент шкалы времени (необязательный, чисто визуал) ---
    const TimeScale = ({ duration = 0 }) => {
        const canvasRef = useRef(null);

        const formatTime = (seconds) => {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const secs = Math.floor(seconds % 60);

            if (hours > 0) {
                return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            }
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        };

        useEffect(() => {
            const canvas = canvasRef.current;
            if (!canvas) return;

            const ctx = canvas.getContext('2d');
            const pixelRatio = window.devicePixelRatio || 1;

            canvas.width = canvas.offsetWidth * pixelRatio;
            canvas.height = 30 * pixelRatio;
            ctx.scale(pixelRatio, pixelRatio);

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (duration > 0) {
                ctx.font = '12px Arial';
                ctx.fillStyle = '#666';
                ctx.strokeStyle = '#999';
                ctx.lineWidth = 1;

                const canvasWidth = canvas.offsetWidth;
                const secondsPerPixel = duration / canvasWidth;
                let interval = 1;

                if (duration > 7200) interval = 600;
                else if (duration > 3600) interval = 300;
                else if (duration > 1800) interval = 120;
                else if (duration > 600) interval = 60;
                else if (duration > 300) interval = 30;
                else interval = 2;

                for (let time = 0; time <= duration; time += interval) {
                    const x = (time / duration) * canvasWidth;

                    ctx.beginPath();
                    ctx.moveTo(x, 0);
                    ctx.lineTo(x, time % (interval * 2) === 0 ? 10 : 5);
                    ctx.stroke();

                    if (time % (interval * 2) === 0) {
                        const timeText = formatTime(time);
                        const metrics = ctx.measureText(timeText);
                        ctx.fillText(timeText, x - metrics.width / 2 + 12, 25);
                    }
                }
            }
        }, [duration]);

        return (
            <canvas
                ref={canvasRef}
                style={{
                    width: '100%',
                    height: '30px',
                    display: 'block',
                    position: 'relative',
                    zIndex: 1
                }}
            />
        );
    };

    // --- Меню в списке видео (просмотр / редактирование / удаление) ---
    const handleMenuClick = (video, action) => {
        if (action === 'view') {
            handleSelectVideo(video);
        } else if (action === 'edit') {
            alert(`Изменить видео: ${video.name}`);
        } else if (action === 'delete') {
            setVideos(videos.filter((v) => v !== video));
            if (selectedVideo === video) {
                setSelectedVideo(null);
            }
        }
    };

    const renderMenu = (video) => (
        <Menu onClick={({ key }) => handleMenuClick(video, key)}>
            <Menu.Item key="view">Просмотр видео</Menu.Item>
            <Menu.Item key="edit">Изменить видео</Menu.Item>
            <Menu.Item key="delete">Удалить</Menu.Item>
        </Menu>
    );

    // --- Логика для тегов ---
    const openTagModal = () => {
        setIsTagModalOpen(true);
    };
    const closeTagModal = () => {
        setIsTagModalOpen(false);
        setTagName('');
        setTagDescription('');
        setTagColor('#1890ff');
    };
    const saveTag = async () => {
        if (!tagName.trim() || !videoRef.current || !selectedVideo) return;
      
        const start = videoRef.current.currentTime;
        const end   = start + 5;
        let savedTag;
        try {
          savedTag = await createTagt({
            name: tagName,
            description: tagDescription,
            color: tagColor,
            timeIntervalstart: floatToTimestamp(start),
            timeIntervalend:   floatToTimestamp(end),
            videoId: selectedVideo.id,
          });
        } catch (err) {
          return message.error('Не удалось сохранить тег: ' + err.message);
        }
      
        const plugin = regionsPluginRef.current;
        // очищаем старые регионы
        plugin.clearRegions();
        // добавляем новый
        const region = plugin.addRegion({
          id:    savedTag.id,
          start, end,
          color: hexToRgba(tagColor, 0.3),
          data:  { tagId: savedTag.id }
        });
      
        setRegions([region]);
        setTags([savedTag, ...tags]);
        closeTagModal();
      };      


    const handleEditTag = (tag) => {
        const regionId = `region-${tag.id}`;
        const region = regions.find(r => r.id === regionId);
        if (!region) {
            message.error('Не найдена область для этого тега');
            return;
        }

        setEditingTag(tag);
        setTagName(tag.name);
        setTagDescription(tag.description);
        setTagColor(tag.color);
        setRegionStart(floatToTimestamp(region.start));
        setRegionEnd(floatToTimestamp(region.end));
        setIsEditModalOpen(true);
    };


    const handleDeleteTag = (tagId) => {
        const regionId = `region-${tagId}`;
        const regionsToDelete = regions.filter((r) => r.id === regionId);

        setRegions((prev) => prev.filter((r) => r.id !== regionId));
        setTags((prev) => prev.filter((t) => t.id !== tagId));

        regionsToDelete.forEach((region) => region.remove());
    };

    const handleTagMenuClick = (tag, key) => {
        switch (key) {
            case 'edit':
                handleEditTag(tag);
                break;
            case 'delete':
                handleDeleteTag(tag.id);
                break;
            default:
                break;
        }
    };

    const saveEditedTag = () => {
        if (tagName.trim() && editingTag) {
            setTags((prevTags) =>
                prevTags.map((tag) =>
                    tag.id === editingTag.id
                        ? {
                            ...tag,
                            name: tagName,
                            description: tagDescription,
                            color: tagColor,
                        }
                        : tag
                )
            );

            if (regionsPluginRef.current) {
                const regionId = `region-${editingTag.id}`;
                let start = timestampToFloat(regionStart);
                let end = timestampToFloat(regionEnd);
                if (start > end) {
                    [start, end] = [end, start];
                }

                // Обновляем/пересоздаём регион
                for (let i in regions) {
                    if (regions[i].id === regionId) {
                        const newRegion = regionsPluginRef.current.addRegion({
                            id: regions[i].id,
                            start: isNaN(start) ? regions[i].start : start,
                            end: isNaN(end) ? regions[i].end : end,
                            color: hexToRgba(tagColor, 0.5)
                        });
                        regions[i].remove();
                        regions[i] = newRegion;
                    }
                }
            }
            closeEditModal();
        }
    };

    const closeEditModal = () => {
        setIsEditModalOpen(false);
        setEditingTag(null);
        setTagName('');
        setTagDescription('');
        setTagColor('#1890ff');
    };

    // --- Вспомогательные функции для перевода float <-> "HH:MM:SS,mmm" ---
    const floatToTimestamp = (value) => {
        let milliseconds = Math.floor(1000.0 * (value - Math.floor(value)));
        milliseconds = String(milliseconds).padStart(3, "0");
        const seconds = String(Math.floor(value) % 60).padStart(2, "0");
        const minutes = String(Math.floor(value / 60) % 60).padStart(2, "0");
        const hours = String(Math.floor(value / 3600)).padStart(2, "0");

        return `${hours}:${minutes}:${seconds},${milliseconds}`;
    };
    const timestampToFloat = (text) => {
        try {
            const parts = text.split(":");
            let seconds = 0, minutes = 0, hours = 0;

            seconds = parts.pop().replace(",", ".");
            if (parts.length > 0) minutes = parts.pop();
            if (parts.length > 0) hours = parts.pop();

            return Number(seconds) + Number(minutes) * 60 + Number(hours) * 3600;
        } catch (exception) {
            return NaN;
        }
    };

    // --- Экспорт тегов в JSON ---
    const exportTags = () => {
        let data = [];

        tags.forEach((tag) => {
            const regionId = `region-${tag.id}`;
            const region = regions.find((r) => r.id === regionId);

            // Безопасная проверка, вдруг региона нет
            if (!region) return;

            data.push({
                tag: tag.name,
                description: tag.description,
                start: floatToTimestamp(region.start),
                end: floatToTimestamp(region.end),
            });
        });

        const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: 'application/json;charset=utf-8;'
        });
        const fileDownloadUrl = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = fileDownloadUrl;
        link.download = "tags.json";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(fileDownloadUrl);
    };

    function parseGeneratedTags(raw) {
        // от raw: { "MM:SS": [names] }
        const entries = Object.entries(raw);
        return entries.flatMap(([time, names], i) => {
            const start = timestampToFloat(time);
            // вычисляем конец: либо до следующей отметки, либо +1 секунда
            const nextTime = entries[i + 1]?.[0];
            const end = nextTime
                ? timestampToFloat(nextTime)
                : start + 1;
            return names.map(name => ({ name, start, end }));
        });
    }

    // Функция-обработчик генерации
    const onGenerateTags = async () => {
        if (!selectedVideo) return;
        setIsGeneratingTags(true);
        try {
            const { tags: raw } = await generateTags(selectedVideo.id);
            const parsed = parseGeneratedTags(raw);

            // 1) Очистить предыдущие сгенерированные регионы
            regions.forEach(r => r.remove());
            setRegions([]);

            // 2) Для каждого сгенерированного тега:
            for (const t of parsed) {
                // случайный цвет в формате #rrggbb
                const color = '#' + Math.floor(Math.random() * 16777215).toString(16);

                // a) добавляем регион в WaveSurfer
                const region = regionsPluginRef.current.addRegion({
                    start: t.start,
                    end: t.end,
                    color: hexToRgba(color, 0.3),
                    data: { name: t.name }
                });
                setRegions(prev => [...prev, region]);

                // b) сохраняем тег на сервере
                await createTagt({
                    name: t.name,
                    description: '',
                    color,
                    timeIntervalstart: floatToTimestamp(t.start),
                    timeIntervalend: floatToTimestamp(t.end),
                    videoId: selectedVideo.id
                });
            }

            // 3) обновляем список «официальных» тегов из API
            setTags(await fetchTagsForVideo(selectedVideo.id));
        } catch (err) {
            console.error(err);
            Modal.error({ title: 'Ошибка генерации', content: err.message });
        } finally {
            setIsGeneratingTags(false);
        }
    };



    // --- Рендер теги и кнопки добавления/сохранения тегов ---
    const renderTags = () => (
        <div style={{ display: 'flex', gap: '10px', marginLeft: '10px', alignItems: 'center' }}>
            <Tag
                color="green"
                onClick={openTagModal}
                style={{
                    cursor: 'pointer',
                    padding: '5px 20px',
                    borderRadius: '40px',
                    fontSize: '14px',
                    backgroundColor: '#d3f9d8',
                    color: '#28a745',
                    border: '1px solid #28a745',
                    transition: 'all 0.3s'
                }}
            >
                + Добавить тег
            </Tag>
            <Tag
                onClick={exportTags}
                style={{
                    cursor: 'pointer',
                    padding: '5px 20px',
                    borderRadius: '40px',
                    fontSize: '14px',
                    backgroundColor: '#d3d8f9',
                    color: '#2845a7',
                    border: '1px solid #2845a7',
                    transition: 'all 0.3s'
                }}
            >
                Сохранить теги
            </Tag>
            {/*{tags.map((tag) => ( */}
            {Array.isArray(tags) && tags.map(tag => (
                <Dropdown
                    key={tag.id}
                    overlay={
                        <Menu onClick={({ key }) => handleTagMenuClick(tag, key)}>
                            <Menu.Item key="edit" icon={<EditOutlined />}>
                                Редактировать тег
                            </Menu.Item>
                            <Menu.Item key="delete" icon={<DeleteOutlined />} danger>
                                Удалить
                            </Menu.Item>
                        </Menu>
                    }
                    trigger={['click']}
                >
                    <Tooltip title={tag.description || "Нет описания"}>
                        <Tag
                            style={{
                                cursor: 'pointer',
                                padding: '5px 20px',
                                borderRadius: '40px',
                                fontSize: '14px',
                                backgroundColor: `${tag.color}20`,
                                color: tag.color,
                                border: `1px solid ${tag.color}`,
                                transition: 'all 0.3s'
                            }}
                        >
                            {tag.name}
                        </Tag>
                    </Tooltip>
                </Dropdown>
            ))}
            {/* Наша новая кнопка */}
            <Button
                loading={isGeneratingTags}
                onClick={onGenerateTags}
                style={{
                    backgroundColor: '#722ed1',
                    borderColor: '#722ed1',
                    color: '#ff0',
                    cursor: 'pointer',
                    padding: '5px 20px',
                    borderRadius: '40px',
                    fontSize: '14px',
                    transition: 'all 0.3s'
                }}
            >
                Сгенерировать теги
            </Button>
            {/* сгенерированные теги */}
            {Array.isArray(generatedTags) && generatedTags.map((t, i) => (
                <Tag key={i} color={t.color || 'purple'}>
                    {t.name}
                </Tag>
            ))}
            {/* Выводим результат, если он есть */}
            {generatedTags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginLeft: '16px' }}>
                    {generatedTags.map((t, i) => (
                        <Tag
                            key={i}
                            color={t.color || 'purple'}
                            style={{ borderRadius: '4px', fontSize: '12px' }}
                        >
                            {t.name}
                        </Tag>
                    ))}
                </div>
            )}
        </div>
    );


    useEffect(() => {
        Promise.all([
            fetchVideost(),
            fetchTagst()
        ])
            .then(([videoData, tagData]) => {
                // для каждого видео добавляем поле src
                const vids = videoData.map(v => ({
                    ...v,
                    src: `${API_BASE}${v.path}`,  // полный URL вида http://localhost:22022/uploads/xxx.mp4
                    type: 'direct'
                }));
                setVideos(vids);
                setTags(tagData);
            })
            .catch(console.error);
    }, []);


    const handleOpenTagModalt = () => setIsTagModalOpen(true);
    const closeTagModalt = () => setIsTagModalOpen(false);

    const onSaveTagt = async () => {
        const tag = { timeInterval: tagTimeInterval, name: tagName, description: tagDescription, timeIntervalstart: tagTimeIntervalstart, timeIntervalend: tagTimeIntervalend };
        try {
            await saveTag(tag);
            setTags(await fetchTagst());
            closeTagModalt();
        } catch (error) {
            console.error(error);
            alert('Ошибка при сохранении тега.');
        }
    };

    // Добавление видео через prompt
    const handleAddVideot = async () => {
        const videoName = prompt('Введите название видео:');
        const videoPath = prompt('Введите локальный путь или URL видео:');
        if (videoName && videoPath) {
            try {
                const newVideo = await saveVideot({ name: videoName, path: videoPath });
                setVideos([...videos, newVideo]);
            } catch (error) {
                console.error(error);
                alert('Ошибка при добавлении видео.');
            }
        }
    };


    return (
        <Layout className="container">
            <Header className="menu-bar">
                <div className="header-content">
                    <span>Screener</span>
                    <img src={logo} alt="Logo" className="logo" />
                </div>
            </Header>
            <div className="horizontal-line"></div>
            <Layout>
                <Sider className="sidebar" width={300}>
                    <List
                        header={<div>Список видео</div>}
                        bordered
                        dataSource={videos}
                        renderItem={(video) => (
                            <List.Item className="video-item">
                                <Checkbox style={{ marginRight: '10px' }} />
                                <span
                                    onClick={() => handleSelectVideo(video)}
                                    style={{ flex: 1, cursor: 'pointer' }}
                                >
                                    {video.name}
                                </span>
                                <Dropdown overlay={renderMenu(video)} trigger={['click']}>
                                    <Button
                                        type="text"
                                        icon={<EllipsisOutlined />}
                                        style={{ marginLeft: '10px' }}
                                    />
                                </Dropdown>
                            </List.Item>
                        )}
                    />
                </Sider>
                <Content className="main-content">
                    {selectedVideo === null ? (
                        <p>Пожалуйста, выберите видео из списка или загрузите новое.</p>
                    ) : (selectedVideo.type === "youtube" ? (
                        <div className="video-container">
                            <YouTube
                                videoId={selectedVideo.src}
                                opts={{
                                    height: '400',
                                    width: '1000',
                                    playerVars: {
                                        autoplay: 0,
                                    }
                                }}
                            />
                        </div>
                    ) : (
                        <>
                            <div className="video-container">
                                <video
                                    style={{ transform: `scale(${scale})` }}
                                    key={selectedVideo.id}
                                    ref={videoRef}
                                    crossOrigin="anonymous"
                                    controls={false}
                                    preload="auto"
                                    width="1000"
                                    height="400"
                                    onError={(e) => {
                                        console.error('Ошибка воспроизведения видео:', e);
                                        alert('Произошла ошибка при воспроизведении видео.');
                                    }}
                                >
                                    <source src={selectedVideo.src} type="video/mp4" />
                                    Ваш браузер не поддерживает элемент video.
                                </video>
                            </div>

                            {/* Блок управления плеером */}
                            <div
                                className="video-controls"
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '6px 0' }}
                            >
                                <span>
                                    {currentTime} / {duration}
                                </span>

                                {/* Зум */}
                                <div className="zoom-container">
                                    <Tooltip title="Уменьшить масштаб">
                                        <Button
                                            className="control-button-plus"
                                            icon={<ZoomOutOutlined />}
                                            onClick={zoomOut}
                                        />
                                    </Tooltip>
                                    <Tooltip title="Увеличить масштаб">
                                        <Button
                                            className="control-button-plus"
                                            icon={<ZoomInOutlined />}
                                            onClick={zoomIn}
                                        />
                                    </Tooltip>
                                </div>

                                {/* Кнопки навигации (предыдущее/следующее и перемотка) */}
                                <div className="video-controls-panel" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
                                    <Tooltip title="Предыдущее видео">
                                        <Button
                                            className="control-button"
                                            icon={<StepBackwardOutlined />}
                                            onClick={() => {
                                                const currentIndex = videos.findIndex((v) => v === selectedVideo);
                                                if (currentIndex > 0) {
                                                    setSelectedVideo(videos[currentIndex - 1]);
                                                }
                                            }}
                                        />
                                    </Tooltip>
                                    <Tooltip title="Перемотать назад 10 секунд">
                                        <Button
                                            className="control-button"
                                            icon={<DoubleLeftOutlined />}
                                            onClick={() => {
                                                if (videoRef.current) {
                                                    videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
                                                }
                                            }}
                                        />
                                    </Tooltip>
                                    <Tooltip title={isPlaying ? "Пауза" : "Воспроизведение"}>
                                        <Button
                                            className="control-button"
                                            icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                                            onClick={togglePlayPause}
                                        />
                                    </Tooltip>
                                    <Tooltip title="Перемотать вперед 10 секунд">
                                        <Button
                                            className="control-button"
                                            icon={<DoubleRightOutlined />}
                                            onClick={() => {
                                                if (videoRef.current) {
                                                    videoRef.current.currentTime = Math.min(videoRef.current.duration, videoRef.current.currentTime + 10);
                                                }
                                            }}
                                        />
                                    </Tooltip>
                                    <Tooltip title="Следующее видео">
                                        <Button
                                            className="control-button"
                                            icon={<StepForwardOutlined />}
                                            onClick={() => {
                                                const currentIndex = videos.findIndex((v) => v === selectedVideo);
                                                if (currentIndex < videos.length - 1) {
                                                    setSelectedVideo(videos[currentIndex + 1]);
                                                }
                                            }}
                                        />
                                    </Tooltip>
                                </div>

                                {/* Правый блок: громкость, настройки, fullscreen */}
                                <div className="player-controls-right" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <div className="volume-control" style={{ position: 'relative' }}>
                                        <Tooltip title="Громкость">
                                            <Button
                                                icon={<SoundOutlined />}
                                                onClick={toggleVolumeSlider}
                                            />
                                        </Tooltip>
                                        {showVolumeSlider && (
                                            <div style={{ position: 'absolute', bottom: '40px', left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
                                                <Slider
                                                    vertical
                                                    value={volume}
                                                    onChange={handleVolumeChange}
                                                    className="volume-slider"
                                                    min={0}
                                                    max={100}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <Dropdown
                                        overlay={
                                            <SettingsMenu
                                                onSpeedChange={handleSpeedChange}
                                                currentSpeed={playbackSpeed}
                                                onDownload={() => handleSettingsMenuClick('download')}
                                            />
                                        }
                                        trigger={['click']}
                                    >
                                        <Tooltip title="Настройки">
                                            <Button icon={<SettingOutlined />} />
                                        </Tooltip>
                                    </Dropdown>

                                    <Tooltip title="Полноэкранный режим">
                                        <Button icon={<FullscreenOutlined />} onClick={toggleFullscreen} />
                                    </Tooltip>
                                </div>
                            </div>

                            <hr style={{ width: 'calc(100% - 20px)', border: '1px solid #ccc', margin: '5px 0 20px 0' }} />

                            {/* Модальное окно "Добавить тег" */}
                            <Modal
                                title="Добавить тег"
                                open={isTagModalOpen}
                                onOk={saveTag}
                                onCancel={closeTagModal}
                                width={500}
                                bodyStyle={{ paddingTop: '20px', paddingBottom: '20px' }}
                                footer={[
                                    <Button key="submit" type="primary" onClick={saveTag}>
                                        Сохранить
                                    </Button>,
                                    <Button key="cancel" onClick={closeTagModal}>
                                        Отмена
                                    </Button>
                                ]}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '14px' }}>
                                    <Input
                                        placeholder="Название тега"
                                        style={{ flex: 1, marginRight: '10px' }}
                                        value={tagName}
                                        onChange={(e) => setTagName(e.target.value)}
                                    />
                                    <div style={{ position: 'relative' }}>
                                        <div
                                            style={{
                                                width: '36px',
                                                height: '36px',
                                                borderRadius: '4px',
                                                border: '1px solid #d9d9d9',
                                                backgroundColor: tagColor,
                                                cursor: 'pointer',
                                                transition: 'border-color 0.3s',
                                            }}
                                            onClick={() => setShowColorPicker(!showColorPicker)}
                                        />
                                        {showColorPicker && (
                                            <div style={{ position: 'absolute', zIndex: 2, right: '-252px', top: '0' }}>
                                                <div
                                                    style={{
                                                        position: 'fixed',
                                                        top: '0px',
                                                        right: '0px',
                                                        bottom: '0px',
                                                        left: '0px',
                                                    }}
                                                    onClick={() => setShowColorPicker(false)}
                                                />
                                                <SketchPicker
                                                    color={tagColor}
                                                    onChange={(color) => setTagColor(color.hex)}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <Text style={{ display: 'block', marginBottom: '7px', marginLeft: '10px' }}>
                                    Описание тега:
                                </Text>
                                <Input.TextArea
                                    rows={4}
                                    style={{ width: 'calc(100% - 20px)', margin: '0 10px' }}
                                    value={tagDescription}
                                    onChange={(e) => setTagDescription(e.target.value)}
                                />
                            </Modal>

                            {renderTags()}

                            {/* Модальное окно "Редактировать тег" */}
                            <Modal
                                title="Редактировать тег"
                                open={isEditModalOpen}
                                onOk={saveEditedTag}
                                onCancel={closeEditModal}
                                width={600}
                                bodyStyle={{ paddingTop: '20px', paddingBottom: '20px' }}
                                footer={[
                                    <Button key="submit" type="primary" onClick={saveEditedTag}>
                                        Сохранить
                                    </Button>,
                                    <Button key="cancel" onClick={closeEditModal}>
                                        Отмена
                                    </Button>
                                ]}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '14px' }}>
                                    <Input
                                        placeholder="Название тега"
                                        style={{ flex: 1, marginRight: '10px' }}
                                        value={tagName}
                                        onChange={(e) => setTagName(e.target.value)}
                                    />
                                    <div style={{ position: 'relative' }}>
                                        <div
                                            style={{
                                                width: '36px',
                                                height: '36px',
                                                borderRadius: '4px',
                                                border: '1px solid #d9d9d9',
                                                backgroundColor: tagColor,
                                                cursor: 'pointer',
                                                transition: 'border-color 0.3s',
                                            }}
                                            onClick={() => setShowColorPicker(!showColorPicker)}
                                        />
                                        {showColorPicker && (
                                            <div style={{ position: 'absolute', zIndex: 2, right: '-252px', top: '0' }}>
                                                <div
                                                    style={{
                                                        position: 'fixed',
                                                        top: '0px',
                                                        right: '0px',
                                                        bottom: '0px',
                                                        left: '0px',
                                                    }}
                                                    onClick={() => setShowColorPicker(false)}
                                                />
                                                <SketchPicker
                                                    color={tagColor}
                                                    onChange={(color) => setTagColor(color.hex)}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <Text style={{ marginBottom: '7px', marginTop: '7px', marginLeft: '5px', padding: '0 5px' }}>
                                    Временной интервал от:
                                </Text>
                                <Input
                                    value={regionStart}
                                    style={{ width: 'calc(25%)', margin: '0 10px' }}
                                    onChange={(e) => setRegionStart(e.target.value)}
                                />
                                <Text>до:</Text>
                                <Input
                                    value={regionEnd}
                                    style={{ width: 'calc(25%)', margin: '0 10px' }}
                                    onChange={(e) => setRegionEnd(e.target.value)}
                                />
                                <Text style={{ display: 'block', marginBottom: '7px', marginLeft: '10px' }}>
                                    Описание тега:
                                </Text>
                                <Input.TextArea
                                    rows={4}
                                    style={{ width: 'calc(100% - 20px)', margin: '0 10px' }}
                                    value={tagDescription}
                                    onChange={(e) => setTagDescription(e.target.value)}
                                />
                            </Modal>

                            <hr style={{ width: 'calc(100% - 20px)', border: '1px solid #ccc', margin: '20px 0' }} />

                            {/* Шкала времени и волна */}
                            <div className="time-scale-container" style={{ width: 'calc(100% - 20px)', margin: '0 0px' }}>
                                <TimeScale duration={videoRef.current?.duration || 0} />
                            </div>
                            <div ref={waveRef} style={{ width: 'calc(100% - 20px)', marginBottom: '20px', marginTop: '20px' }}></div>
                        </>)
                    )}
                </Content>
            </Layout>

            {/* Кнопка "Загрузить файл" открывает одну динамическую модалку */}
            <Button className="upload-button" type="primary" onClick={() => setIsUploadModalOpen(true)}>
                Загрузить файл
            </Button>

            {/* ОДНА динамическая модалка для всех способов загрузки */}
            <Modal
                title="Загрузка видео"
                open={isUploadModalOpen}
                onCancel={() => isUploading ? null : setIsUploadModalOpen(false)}
                footer={null}
                style={{ marginTop: '100px' }}
            >
                {isUploading ? (
                    <div style={{ textAlign: 'center', padding: 50 }}>
                        <Spin size="large" tip="Загрузка..." />
                    </div>
                ) : (
                    <>
                        <Radio.Group
                            onChange={(e) => setUploadMethod(e.target.value)}
                            value={uploadMethod}
                        >
                            <Radio value="local">Локальная загрузка файла</Radio>
                            <Radio value="url">Загрузка файла по URL</Radio>
                        </Radio.Group>

                        {uploadMethod === 'local' && (
                            <div
                                {...getRootProps({ className: 'dropzone' })}
                                style={{
                                    border: '2px dashed #1890ff',
                                    padding: '20px',
                                    textAlign: 'center',
                                    cursor: isUploading ? 'not-allowed' : 'pointer'
                                }}
                            >
                                <input {...getInputProps()} />
                                <p>Перетащите видео сюда или нажмите кнопку</p>
                                <Button icon={<PlusOutlined />} disabled={isUploading}>
                                    Выбрать файл
                                </Button>
                            </div>
                        )}

                        {uploadMethod === 'url' && (
                            <>
                                <Input
                                    placeholder="Введите URL видео"
                                    value={inputUrl}
                                    onChange={(e) => setInputUrl(e.target.value)}
                                    style={{ marginBottom: '10px' }}
                                />
                                <Button type="primary" onClick={addVideoFromUrl} disabled={isUploading}>
                                    Загрузить по URL
                                </Button>
                            </>
                        )}
                    </>
                )}
            </Modal>
        </Layout>
    );
};

export default VideoUploadApp;
