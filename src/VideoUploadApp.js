import React, { useState, useRef, useEffect } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import { Button, List, Layout, Checkbox, Dropdown, Menu, Slider, Tooltip, Tag, Input, Modal, Typography } from 'antd';
import { SketchPicker } from 'react-color';

import { 
  PlayCircleOutlined, PauseCircleOutlined, SoundOutlined, EllipsisOutlined, 
  FullscreenOutlined, SettingOutlined, DoubleLeftOutlined, DoubleRightOutlined, 
  StepForwardOutlined, StepBackwardOutlined, ZoomInOutlined, ZoomOutOutlined, 
  PlusOutlined, EditOutlined, DeleteOutlined
} from '@ant-design/icons';
import { useDropzone } from 'react-dropzone';

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

const VideoUploadApp = () => {
  // Состояния компонентов
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [videos, setVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [wavesurfer, setWavesurfer] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [volume, setVolume] = useState(50); // Начальная громкость: 50%
  const [currentTime, setCurrentTime] = useState('00:00');
  const [duration, setDuration] = useState('00:00');
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // Начальная скорость воспроизведения
  const [scale, setScale] = useState(1); // Масштаб видео

  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [tagName, setTagName] = useState('');
  const [tagDescription, setTagDescription] = useState('');
  const [tagColor, setTagColor] = useState('#1890ff'); // Цвет по умолчанию
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [tags, setTags] = useState([]);

  const [editingTag, setEditingTag] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [regions, setRegions] = useState([]);

  const videoRef = useRef(null);
  const waveformRef = useRef(null);
  const regionsPluginRef = useRef(null); // Ссылка на плагин Regions

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  // Обработка загрузки файлов
  const onDrop = (acceptedFiles) => {
    const videoFiles = acceptedFiles.map((file) => ({
      name: file.name,
      src: URL.createObjectURL(file),
    }));
    setVideos([...videos, ...videoFiles]);
    closeModal();
  };

  // Настройка dropzone для загрузки видео
  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      'video/mp4': ['.mp4'],
      'video/webm': ['.webm'],
      'video/ogg': ['.ogv'],
      'video/mkv': ['.mkv'],
      'video/mov': ['.mov'],
    },
  });

  // Переключает видео в полноэкранный режим
  const toggleFullscreen = () => {
    if (videoRef.current.requestFullscreen) {
      videoRef.current.requestFullscreen();
    } else if (videoRef.current.webkitRequestFullscreen) {
      videoRef.current.webkitRequestFullscreen();
    } else if (videoRef.current.msRequestFullscreen) {
      videoRef.current.msRequestFullscreen();
    }
  };

  // Обработка кликов по меню настроек
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

  // Масштабирование видео
  const zoomIn = () => {
    setScale((prevScale) => Math.min(prevScale + 0.1, 2));
  };

  const zoomOut = () => {
    setScale((prevScale) => Math.max(prevScale - 0.1, 0.5));
  };

  // Воспроизведение/пауза видео
  const togglePlayPause = () => {
    if (videoRef.current.paused) {
      videoRef.current.play();
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

  // Управление громкостью
  const toggleVolumeSlider = () => {
    setShowVolumeSlider((prev) => !prev); // Переключение видимости шкалы громкости
  };

  const handleVolumeChange = (value) => {
    setVolume(value); // Обновление состояния громкости
    if (videoRef.current) {
      videoRef.current.volume = value / 100; // Преобразование диапазона (0-100) в (0-1)
    }
  };

  // Форматирование времени ЧЧ:ММ:СС
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

  // Обновленная функция создания региона
  const handleRegionCreated = (region) => {
    console.log('Регион создан:', region);
    // Добавляем регион в состояние
    setRegions(prevRegions => [...prevRegions, region]);
    
    // Если регион создан с привязанным тегом, обновляем массив регионов
    if (region.data && region.data.tagId) {
      const tag = tags.find(t => t.id === region.data.tagId);
      if (tag) {
        region.data = {
          ...region.data,
          label: tag.name,
          description: tag.description,
          color: tag.color
        };
      }
    }
  };

  // Обновленная функция обновления региона
  const handleRegionUpdated = (region) => {
    console.log('Регион обновлен:', region);
    setRegions(prevRegions => 
      prevRegions.map(r => r.id === region.id ? region : r)
    );
  };

  // Обновленная функция удаления региона
  const handleRegionRemoved = (region) => {
    console.log('Region removed:', region);
    
    setRegions(prevRegions => prevRegions.filter(r => r.id !== region.id));
    
    if (region.data?.tagId) {
      setTags(prevTags => prevTags.filter(tag => tag.id !== region.data.tagId));
    }
  };


  // Обновление времени
  const updateTime = () => {
    if (videoRef.current) {
      setCurrentTime(formatTimeWithHours(videoRef.current.currentTime));
      setDuration(formatTimeWithHours(videoRef.current.duration || 0));
    }
  };

  // Изменение скорости воспроизведения видео
  const handleSpeedChange = (speed) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
      setPlaybackSpeed(speed);
    }
  };

  // Инициализация и обновление WaveSurfer при выборе видео
  useEffect(() => {
    if (!selectedVideo || !waveformRef.current) return;

    // Уничтожаем предыдущий экземпляр, если он есть
    if (wavesurfer) {
      wavesurfer.destroy();
      setWavesurfer(null);
      regionsPluginRef.current = null;
    }

    // Инициализация WaveSurfer с плагином Regions
    const regionsPlugin = RegionsPlugin.create({
      dragSelection: {
        slop: 5,
      },
    });

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: '#007bff',
      progressColor: '#00aaff',
      height: 60,
      responsive: true,
      backend: 'MediaElement',
      plugins: [regionsPlugin],
    });

    regionsPluginRef.current = regionsPlugin; // Сохраняем ссылку на плагин

    // Загрузка видео в WaveSurfer
    ws.load(selectedVideo.src);

    // События плеера WaveSurfer
    ws.on('ready', () => {
      // Синхронизация текущего времени видео с WaveSurfer
      if (videoRef.current && videoRef.current.duration) {
        const progress = videoRef.current.currentTime / videoRef.current.duration;
        ws.seekTo(progress);
      }
    });

    // При событии play видео запускается, если оно было на паузе
    ws.on('play', () => {
      if (videoRef.current && videoRef.current.paused) {
        videoRef.current.play();
        setIsPlaying(true);
      }
    });

    // При событии pause видео ставится на паузу, если оно в данный момент играет
    ws.on('pause', () => {
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    });

    // При событии seek изменяется текущее время видео в соответствии с новой позицией на звуковой волне
    ws.on('seek', (progress) => {
      if (videoRef.current && videoRef.current.duration) {
        const newTime = progress * videoRef.current.duration;
        videoRef.current.currentTime = newTime;
      }
    });

    // Региональные события
    ws.on('region-created', handleRegionCreated);
    ws.on('region-updated', handleRegionUpdated);
    ws.on('region-removed', handleRegionRemoved);

    setWavesurfer(ws);

    // Очистка ресурсов при размонтировании компонента
    // (Уничтожает экземпляр WaveSurfer, очищает состояние и ссылку на плагин)
    return () => {
      ws.destroy();
      setWavesurfer(null);
      regionsPluginRef.current = null;
    };
  }, [selectedVideo]);

  // Синхронизация Video с WaveSurfer
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

      // Добавление обработчиков событий для видео
      videoElement.addEventListener('play', handleVideoPlay);
      videoElement.addEventListener('pause', handleVideoPause);
      videoElement.addEventListener('seeked', handleVideoSeek);
      videoElement.addEventListener('timeupdate', updateTime);
      videoElement.addEventListener('loadedmetadata', updateTime);

      // Синхронизация при взаимодействии с WaveSurfer
      wavesurfer.on('interaction', () => {
        if (videoRef.current && wavesurfer.getCurrentTime) {
          videoRef.current.currentTime = wavesurfer.getCurrentTime();
        }
      });

      // Очистка обработчиков событий при размонтировании
      // (Удаляет ранее добавленные обработчики событий для видео и освобождает ресурсы)
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

  // Обработчик выбора видео из списка
  const handleMenuClick = (video, action) => {
    if (action === 'view') {
      setSelectedVideo(video);
    } else if (action === 'edit') {
      alert(`Изменить видео: ${video.name}`);
    } else if (action === 'delete') {
      setVideos(videos.filter((v) => v !== video));
      if (selectedVideo === video) {
        setSelectedVideo(null);
      }
    }
  };

  // Рендеринг меню для каждого видео
  const renderMenu = (video) => (
    <Menu onClick={({ key }) => handleMenuClick(video, key)}>
      <Menu.Item key="view">Просмотр видео</Menu.Item>
      <Menu.Item key="edit">Изменить видео</Menu.Item>
      <Menu.Item key="delete">Удалить</Menu.Item>
    </Menu>
  );

  // Открытие и закрытие модального окна для тегов
  const openTagModal = () => {
    setIsTagModalOpen(true);
  };

  const closeTagModal = () => {
    setIsTagModalOpen(false);
    // Очистка полей
    setTagName('');
    setTagDescription('');
    setTagColor('#1890ff');
  };

  // Обновленная функция сохранения тега
  const saveTag = () => {
    if (tagName.trim() && wavesurfer && videoRef.current) {
      const newTag = {
        id: Date.now(),
        name: tagName,
        description: tagDescription,
        color: tagColor,
      };

      // Создаем новый регион с привязкой к тегу
      const currentTime = videoRef.current.currentTime;
      const regionDuration = 5;
      const regionsPlugin = regionsPluginRef.current;
      
      if (regionsPlugin) {
        const hexToRgba = (hex, alpha = 1) => {
          const r = parseInt(hex.slice(1, 3), 16);
          const g = parseInt(hex.slice(3, 5), 16);
          const b = parseInt(hex.slice(5, 7), 16);
          return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        };

        // Создаем новый регион
        const newRegion = regionsPlugin.addRegion({
          id: `region-${newTag.id}`,
          start: currentTime,
          end: currentTime + regionDuration,
          color: hexToRgba(tagColor, 0.5),
          data: {
            tagId: newTag.id,
            label: tagName,
            description: tagDescription
          },
        });

        // Добавляем регион в состояние
        setRegions(prevRegions => [...prevRegions, newRegion]);
      }

      // Добавляем тег в состояние
      setTags(prevTags => [...prevTags, newTag]);
      closeTagModal();
    }
  };

  // Функции для работы с тегами
  const handleEditTag = (tag) => {
    setEditingTag(tag);
    setTagName(tag.name);
    setTagDescription(tag.description);
    setTagColor(tag.color);
    setIsEditModalOpen(true);
  };

  // Обновленная функция удаления тега
  const handleDeleteTag = (tagId) => {
  
    const regionsToDelete = regions.filter(region => region.data?.tagId === tagId);
    
    regionsToDelete.forEach(region => {
      if (regionsPluginRef.current) {
        const regionObj = regionsPluginRef.current.regions.list[region.id];
        if (regionObj) {
          regionObj.remove();
        }
      }
    });
   
    setRegions(prevRegions => prevRegions.filter(region => region.data?.tagId !== tagId));
     
    setTags(prevTags => prevTags.filter(tag => tag.id !== tagId));
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

  // Обновленная функция редактирования тега
  const saveEditedTag = () => {
    if (tagName.trim() && editingTag) {
      // Обновляем тег
      setTags(prevTags =>
        prevTags.map(tag =>
          tag.id === editingTag.id
            ? {
                ...tag,
                name: tagName,
                description: tagDescription,
                color: tagColor
              }
            : tag
        )
      );

      // Обновляем все регионы, связанные с этим тегом
      if (regionsPluginRef.current) {
        const hexToRgba = (hex, alpha = 1) => {
          const r = parseInt(hex.slice(1, 3), 16);
          const g = parseInt(hex.slice(3, 5), 16);
          const b = parseInt(hex.slice(5, 7), 16);
          return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        };

        regions.forEach(region => {
          if (region.data?.tagId === editingTag.id) {
            const regionObj = regionsPluginRef.current.regions.list[region.id];
            if (regionObj) {
              regionObj.color = hexToRgba(tagColor, 0.5);
              regionObj.data = {
                ...regionObj.data,
                label: tagName,
                description: tagDescription
              };
            }
          }
        });

        // Обновляем состояние регионов
        setRegions(prevRegions =>
          prevRegions.map(region =>
            region.data?.tagId === editingTag.id
              ? {
                  ...region,
                  color: hexToRgba(tagColor, 0.5),
                  data: {
                    ...region.data,
                    label: tagName,
                    description: tagDescription
                  },
                }
              : region
          )
        );
      }

      closeEditModal();
    }
  };

  // Добавляем эффект для восстановления регионов при перезагрузке WaveSurfer
  {/*useEffect(() => {
    if (!selectedVideo || !waveformRef.current) return;
  
    if (wavesurfer) {
      wavesurfer.destroy();
      setWavesurfer(null);
      regionsPluginRef.current = null;
    }
  
    const regionsPlugin = RegionsPlugin.create({
      dragSelection: {
        slop: 5,
      },
    });
  
    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: '#007bff',
      progressColor: '#00aaff',
      height: 60,
      responsive: true,
      backend: 'MediaElement',
      plugins: [regionsPlugin],
    });
  
    regionsPluginRef.current = regionsPlugin;
    ws.load(selectedVideo.src);
  
    // Add improved region event handlers
    ws.on('region-created', handleRegionCreated);
    ws.on('region-updated', handleRegionUpdated);
    ws.on('region-removed', handleRegionRemoved);
  
    setWavesurfer(ws);
  
    return () => {
      ws.destroy();
      setWavesurfer(null);
      regionsPluginRef.current = null;
    };
  }, [selectedVideo]); */}

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditingTag(null);
    setTagName('');
    setTagDescription('');
    setTagColor('#1890ff');
  };

  // Обновленный рендеринг тегов
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
      {tags.map((tag) => (
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
    </div>
  );

  return (
    <Layout className="container">
      <Header className="menu-bar">Screener</Header>
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
                  onClick={() => setSelectedVideo(video)}
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
          {selectedVideo ? (
            <>
              <video
                style={{ transform: `scale(${scale})` }}
                ref={videoRef}
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
              {/* Кастомная панель управления */}
              <div className="video-controls" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '10px 0' }}> 
                {/* Отображение текущего времени и общей длительности видео */}
                <span>
                  {currentTime} / {duration}
                </span>
                {/* Кнопки масштабирования */}
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
                {/* Основные элементы управления воспроизведением */}
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
                {/* Блок с громкостью, настройками и полноэкранным режимом */}
                <div className="player-controls-right" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  {/* Громкость */}
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
                  {/* Настройки */}
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
                  {/* Полноэкранный режим */}
                  <Tooltip title="Полноэкранный режим">
                    <Button icon={<FullscreenOutlined />} onClick={toggleFullscreen} />
                  </Tooltip>
                </div>
              </div>
              {/* Горизонтальная линия */}
              <hr style={{ width: 'calc(100% - 20px)', border: '1px solid #ccc', margin: '20px 0' }} />  
               {/* Модальное окно для создания тега */}
               <Modal
                title="Добавить тег"
                open={isTagModalOpen}
                onOk={saveTag}
                onCancel={closeTagModal}
                width={500}
                bodyStyle={{ 
                  paddingTop: '20px',
                  paddingBottom: '20px'
                }}
                footer={[
                  <Button key="submit" type="primary" onClick={saveTag}>
                    Сохранить
                  </Button>,
                  <Button key="cancel" onClick={closeTagModal}>
                    Отмена
                  </Button>
                ]}
              >
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  marginBottom: '14px' 
                }}>
                  <Input 
                    placeholder="Название тега" 
                    style={{ 
                      flex: 1, 
                      marginRight: '10px' 
                    }}
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
                      <div style={{
                        position: 'absolute',
                        zIndex: 2,
                        right: '-252px',
                        top: '0',
                      }}>
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
                <Text style={{ 
                  display: 'block', 
                  marginBottom: '7px',
                  marginLeft: '10px' 
                }}>
                  Описание тега:
                </Text>

                <Input.TextArea 
                  rows={4} 
                  style={{ 
                    width: 'calc(100% - 20px)', 
                    margin: '0 10px' 
                  }}
                  value={tagDescription}
                  onChange={(e) => setTagDescription(e.target.value)}
                />
              </Modal>                
              {renderTags()}  
                <Modal
                  title="Редактировать тег"
                  open={isEditModalOpen}
                  onOk={saveEditedTag}
                  onCancel={closeEditModal}
                  width={500}
                  bodyStyle={{ 
                    paddingTop: '20px',
                    paddingBottom: '20px'
                  }}
                  footer={[
                    <Button key="submit" type="primary" onClick={saveEditedTag}>
                      Сохранить
                    </Button>,
                    <Button key="cancel" onClick={closeEditModal}>
                      Отмена
                    </Button>
                  ]}
                >
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    marginBottom: '14px' 
                  }}>
                    <Input 
                      placeholder="Название тега" 
                      style={{ 
                        flex: 1, 
                        marginRight: '10px' 
                      }}
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
                        <div style={{
                          position: 'absolute',
                          zIndex: 2,
                          right: '-252px',
                          top: '0',
                        }}>
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
                  <Text style={{ 
                    display: 'block', 
                    marginBottom: '7px',
                    marginLeft: '10px' 
                  }}>
                    Описание тега:
                  </Text>
                  <Input.TextArea 
                    rows={4} 
                    style={{ 
                      width: 'calc(100% - 20px)', 
                      margin: '0 10px' 
                    }}
                    value={tagDescription}
                    onChange={(e) => setTagDescription(e.target.value)}
                  />
                </Modal>
             
              {/* Горизонтальная линия */}
              <hr style={{ width: 'calc(100% - 20px)', border: '1px solid #ccc', margin: '20px 0' }} />
              {/* Контейнер для WaveSurfer */}
              <div ref={waveformRef} style={{ width: 'calc(100% - 20px)', marginBottom: '20px', marginTop: '20px' }}></div>             
            </>
          ) : (
            <p>Выберите видео для просмотра</p>
          )}
        </Content>
      </Layout>
      {/* Кнопка для открытия модального окна загрузки */}
      <Button className="upload-button" type="primary" onClick={openModal}>
        Загрузить файл
      </Button>
      {/* Модальное окно загрузки */}
      {isModalOpen && (
        <div className="modal">
          <div className="modal-content">
            <h3>Загрузка видео</h3>
            <div 
              {...getRootProps({ className: 'dropzone' })} 
              style={{ border: '2px dashed #1890ff', padding: '20px', textAlign: 'center', cursor: 'pointer' }}
            >
              <input {...getInputProps()} />
              <p>Перетащите файл видео сюда или нажмите на кнопку</p>
              <Button icon={<PlusOutlined />}>Выбрать файл</Button>
            </div>
            <Button onClick={closeModal} style={{ marginTop: '20px' }}>
              Закрыть
            </Button>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default VideoUploadApp;
