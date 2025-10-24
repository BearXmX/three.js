
import React, { useState, useEffect, useRef } from 'react'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import * as THREE from 'three'
import { Water } from 'three/examples/jsm/objects/Water.js'
import { Sky } from 'three/examples/jsm/objects/Sky.js'
type PointPlanePropsType = {

}

const PointPlane: React.FC<PointPlanePropsType> = (props) => {
  const canvas = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const main = () => {
    // 渲染器
    const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: canvas.current! })

    rendererRef.current = renderer
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.localClippingEnabled = true;
    // 视角
    const fov = 75

    // 宽高比
    const aspect = window.innerWidth / window.innerHeight  // the canvas default

    // 近平面
    const near = 0.1

    // 远平面
    const far = 1000

    // 相机
    const camera = new THREE.PerspectiveCamera(fov, aspect, near, far)

    camera.position.z = 5

    camera.position.x = 0

    camera.position.y = 5

    // 场景
    const scene = new THREE.Scene()

    const color = '#ffffff'
    /* 
        const intensity = 10
    
        // 定向光源
        const light = new THREE.DirectionalLight(color, intensity)
    
        // z为负数，表示光源朝向负z轴（背面）
        light.position.set(0, 1, 1)
        scene.add(light) */


    // 添加世界坐标辅助器
    const axesHelper = new THREE.AxesHelper(5);

    scene.add(axesHelper);

    // 导入控制器
    const controls = new OrbitControls(camera, canvas.current)
    // 设置带阻尼的惯性
    controls.enableDamping = true
    // 设置阻尼系数
    controls.dampingFactor = 0.05

    // 控制器自动旋转
    // controls.autoRotate = true


    const light = new THREE.HemisphereLight(0xffffff, 0x080808, 4.5);
    light.position.set(- 1.25, 1, 1.25);
    scene.add(light);



    //

    const clipPlanes = [
      new THREE.Plane(new THREE.Vector3(1, 0, 0), 0),
      new THREE.Plane(new THREE.Vector3(0, - 1, 0), 0),
      new THREE.Plane(new THREE.Vector3(0, 0, - 1), 0)
    ];


    const params = {
      clipIntersection: true,
      planeConstant: 0,
      showHelpers: false,
      alphaToCoverage: true,
    };


    const group = new THREE.Group();

    for (let i = 1; i <= 30; i += 5) {

      console.log(i);


      const geometry = new THREE.SphereGeometry(i / 30, 48, 24);

      const material = new THREE.MeshPhongMaterial({

        color: new THREE.Color().setHSL(Math.random(), 0.5, 0.5, THREE.SRGBColorSpace),
        side: THREE.DoubleSide,
        clippingPlanes: clipPlanes,
        clipIntersection: params.clipIntersection,
        alphaToCoverage: true,
      });
      group.add(new THREE.Mesh(geometry, material));

    }

    scene.add(group);

    // helpers

    const helpers = new THREE.Group();
    helpers.add(new THREE.PlaneHelper(clipPlanes[0], 2, 0xff0000));
    helpers.add(new THREE.PlaneHelper(clipPlanes[1], 2, 0x00ff00));
    helpers.add(new THREE.PlaneHelper(clipPlanes[2], 2, 0x0000ff));
    helpers.visible = false
    scene.add(helpers);

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

    handleResize()

    function render(time: number) {
      if (!canvas.current) return;

      handleResize()

      const seconds = time * 0.001; // 将毫秒转换为秒



      renderer.render(scene, camera)

      // 更新控制器
      controls.update()
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

  return (
    <div className="canvas-container">
      <canvas className="canvas-body" ref={canvas}></canvas>
    </div>
  )

}

export default PointPlane