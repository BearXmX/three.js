import React, { useState, useEffect, useRef } from 'react'
import * as THREE from 'three'

type SpherePropsType = {

}

const Sphere: React.FC<SpherePropsType> = (props) => {

  const { } = props

  const canvas = useRef<HTMLCanvasElement>(null)

  const main = () => {

    // 创建渲染器
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      canvas: canvas.current!,
    });

    // 视角
    const fov = 110

    // 宽高比
    const aspect = window.innerWidth / window.innerHeight // the canvas default

    // 近平面
    const near = 0.1

    // 远平面
    const far = 1000

    // 创建相机
    const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);

    camera.position.z = 30

    // 创建场景
    const scene = new THREE.Scene();

    // 绘制几何图形
    const geometry = new THREE.SphereGeometry(15, 32, 16);

    const material = new THREE.MeshStandardMaterial({
      color: '#fff',
      wireframe: true,   // 添加线框
      side: THREE.DoubleSide,
    });

    const sphere = new THREE.Mesh(geometry, material);

    console.log(sphere.geometry.attributes);

    sphere.rotation.z = (Math.PI / 180) * 23.5;

    scene.add(sphere);

    // 定向光源
    const color = 'rgba(101, 101, 101)'

    const intensity = 20

    const light = new THREE.DirectionalLight(color, intensity)

    light.position.set(10, 10, 7)

    scene.add(light)

    // 窗口大小调整
    const handleResize = () => {
      if (!canvas.current) return;
      const { clientWidth: width, clientHeight: height } = canvas.current;
      if (renderer.domElement.width !== width || renderer.domElement.height !== height) {
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
    };

    function render(time: number) {
      if (!canvas.current) return;

      handleResize()

      // 动画之类的操作
      sphere.rotation.y += 0.005;

      renderer.render(scene, camera)

      requestAnimationFrame(render)
    }

    requestAnimationFrame(render)

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      renderer?.dispose();
    }
  }

  useEffect(() => {
    if (!canvas.current) return

    const clean = main()

    return clean
  }, [canvas.current])

  return <div className='canvas-container'>

    <canvas className='canvas-body' ref={canvas}></canvas>

  </div>

}

export default Sphere