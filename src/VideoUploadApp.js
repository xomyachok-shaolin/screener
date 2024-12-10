import React, { useState, useRef, useEffect } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import { Button, List, Layout, Checkbox, Dropdown, Menu, Slider, Tooltip } from 'antd';
import { 
  PlayCircleOutlined, PauseCircleOutlined, SoundOutlined, EllipsisOutlined, 
  FullscreenOutlined, SettingOutlined, DoubleLeftOutlined, DoubleRightOutlined, 
  StepForwardOutlined, StepBackwardOutlined, ZoomInOutlined, ZoomOutOutlined, 
  PlusOutlined
} from '@ant-design/icons';
import { useDropzone } from 'react-dropzone';

import 'antd/dist/antd.css';
import './styles/styles.css';

const { Header, Sider, Content } = Layout;

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

  const videoRef = useRef(null);
  const waveformRef = useRef(null);
  const regionsPluginRef = useRef(null); // Ссылка на плагин Regions

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  const onDrop = (acceptedFiles) => {
    const videoFiles = acceptedFiles.map((file) => ({
      name: file.name,
      src: URL.createObjectURL(file),
    }));
    setVideos([...videos, ...videoFiles]);
    closeModal();
  };

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

  const toggleFullscreen = () => {
    if (videoRef.current.requestFullscreen) {
      videoRef.current.requestFullscreen();
    } else if (videoRef.current.webkitRequestFullscreen) {
      videoRef.current.webkitRequestFullscreen();
    } else if (videoRef.current.msRequestFullscreen) {
      videoRef.current.msRequestFullscreen();
    }
  };

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

  const zoomIn = () => {
    setScale((prevScale) => Math.min(prevScale + 0.1, 2));
  };

  const zoomOut = () => {
    setScale((prevScale) => Math.max(prevScale - 0.1, 0.5));
  };

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

  const toggleVolumeSlider = () => {
    setShowVolumeSlider((prev) => !prev);
  };

  const handleVolumeChange = (value) => {
    setVolume(value);
    if (videoRef.current) {
      videoRef.current.volume = value / 100;
    }
  };

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

  const handleRegionCreated = (region) => {
    console.log('Регион создан:', region);
    // Здесь можно добавить логику для сохранения тегов или дополнительной информации о регионе
  };

  const handleRegionUpdated = (region) => {
    console.log('Регион обновлен:', region);
    // Обновление информации о регионе при изменении
  };

  const handleRegionRemoved = (region) => {
    console.log('Регион удален:', region);
    // Обработка удаления региона
  };

  const updateTime = () => {
    if (videoRef.current) {
      setCurrentTime(formatTimeWithHours(videoRef.current.currentTime));
      setDuration(formatTimeWithHours(videoRef.current.duration || 0));
    }
  };

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
      height: 80,
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

    ws.on('play', () => {
      if (videoRef.current && videoRef.current.paused) {
        videoRef.current.play();
        setIsPlaying(true);
      }
    });

    ws.on('pause', () => {
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    });

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
              {/* Контейнер для WaveSurfer */}
              <div ref={waveformRef} style={{ width: '100%', marginBottom: '20px' }}></div>
              {/* Кнопка для добавления региона (тегирования) */}
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  if (wavesurfer && videoRef.current) {
                    const currentTime = videoRef.current.currentTime;
                    const regionDuration = 5; // Длительность региона в секундах
                    const regionsPlugin = regionsPluginRef.current;
                    if (regionsPlugin && regionsPlugin.regions) {
                      regionsPlugin.addRegion({
                        start: currentTime,
                        end: currentTime + regionDuration,
                        color: 'rgba(255, 0, 0, 0.3)',
                        data: { label: 'Новый тег' },
                      });
                    } else {
                      console.error('RegionsPlugin или regions отсутствуют.');
                    }
                  }
                }}
              >
                Добавить тег
              </Button>
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
