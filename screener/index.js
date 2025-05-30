import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom'; // Импортирует ReactDOM для рендеринга приложения.
// Преобразует трехмерную модель или сцену из компьютерной программы в изображение
import Wavesurfer from 'react-wavesurfer';
import WaveSurfer from 'wavesurfer.js';
import { Button, List, Layout, Checkbox, Dropdown, Menu } from 'antd'; 
import { useDropzone } from 'react-dropzone';
import 'antd/dist/antd.css';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import './styles.css';
import { EllipsisOutlined } from '@ant-design/icons'; // Импортируем иконку для трех точек

const { Header, Sider, Content } = Layout;

const VideoUploadApp = () => {
    // Состояния
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [videos, setVideos] = useState([]);
    const [selectedVideo, setSelectedVideo] = useState(null);
    //const [progress, setProgress] = useState(0);
    const [currentTime, setCurrentTime] = useState(0); // Состояние для текущего времени
    const videoRef = useRef(null);
    //const wavesurferRef = useRef(null);
    
    // Функции управления
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

    // Настройка drag-and-drop 
    const { getRootProps, getInputProps } = useDropzone({
        onDrop,
        accept: 'video/*',
    });

    // Обработчик выбора видео
    const handleVideoClick = (video) => setSelectedVideo(video);

    // Обработчик обновления времени видео
    const handleTimeUpdate = () => {
        if (videoRef.current) {
            const currentTime = videoRef.current.currentTime;
            setCurrentTime(currentTime);
            //if (wavesurferRef.current) {
             //   wavesurferRef.current.seekTo(currentTime / videoRef.current.duration);
            //}
        }
    };

    /*const handlePlayPause = () => {
        if (videoRef.current && wavesurferRef.current) {
            if (videoRef.current.paused) {
                videoRef.current.play();
                wavesurferRef.current.play();
            } else {
                videoRef.current.pause();
                wavesurferRef.current.pause();
            }
        }
    };*/

    const handlePlayPause = () => {
        if (videoRef.current) {
            if (videoRef.current.paused) {
                videoRef.current.play();
            } else {
                videoRef.current.pause();
            }
        }
    };

    const handleWavesurferTimeUpdate = (time) => {
        setCurrentTime(time);
        if (videoRef.current && videoRef.current.currentTime !== time) {
            videoRef.current.currentTime = time;
        }
    };

    const handleMenuClick = (video, action) => {
        if (action === 'view') {
            handleVideoClick(video);
        } else if (action === 'edit') {
            alert(`Изменить видео: ${video.name}`);
        } else if (action === 'delete') {
            setVideos(videos.filter((v) => v !== video));
        }
    };

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
                <Sider className="sidebar">
                    <List
                        header={<div>Список видео</div>}
                        bordered
                        dataSource={videos}
                        renderItem={(video) => (
                            <List.Item className="video-item">
                                <Checkbox style={{ marginRight: '10px' }} />
                                <span onClick={() => handleVideoClick(video)} style={{ flex: 1 }}>
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
                                ref={videoRef}
                                id="video-player"
                                className="video-js"
                                controls
                                preload="auto"
                                onTimeUpdate={handleTimeUpdate}
                                onPlay={handlePlayPause}
                                onPause={handlePlayPause}
                                width="900"
                                height="400"
                            >
                                <source src={selectedVideo.src} type="video/mp4" />
                            </video>
                            <Wavesurfer
                                //ref={wavesurferRef}
                                audioFile={selectedVideo.src}
                                onTimeChange={handleWavesurferTimeUpdate}
                                options={{
                                    height: 100,
                                    waveColor: '#007bff',
                                    progressColor: '#00aaff',
                                }}
                            />
                        </>
                    ) : (
                        <p>Выберите видео для просмотра</p>
                    )}
                </Content>
            </Layout>
            <Button className="upload-button" onClick={openModal}>
                Загрузить файл
            </Button>
            {isModalOpen && (
                <div className="modal">
                    <div className="modal-content">
                        <h3>Загрузка видео</h3>
                        <div {...getRootProps({ className: 'dropzone' })}>
                            <input {...getInputProps()} />
                            <p>Перетащите файл видео сюда или нажмите на кнопку</p>
                            <Button>Выбрать файл</Button>
                        </div>
                        <Button onClick={closeModal} style={{ marginTop: 10 }}>
                            Закрыть
                        </Button>
                    </div>
                </div>
            )}
        </Layout>
    );
};

ReactDOM.render(<VideoUploadApp />, document.getElementById('root'));





