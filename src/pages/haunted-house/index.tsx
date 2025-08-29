import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { log } from 'three/src/nodes/TSL.js';

type HauntdHousePropsType = {

}

const HauntdHouse: React.FC<HauntdHousePropsType> = (props) => {

  const { } = props

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const rendererRef = useRef<THREE.WebGLRenderer>(null);

  const initScene = () => {

    /* 渲染器 */
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current!,
    });

    renderer.setPixelRatio(window.devicePixelRatio);
    rendererRef.current = renderer;
    renderer.setClearColor('#262837')


    /* 场景 */
    const scene = new THREE.Scene();

    /* 雾 */
    const fog = new THREE.Fog('#262837', 1, 15);
    scene.fog = fog;

    /* 环境光 */
    const ambientLight = new THREE.AmbientLight('#b9d5ff', 0.3);
    scene.add(ambientLight);

    /* 定向光 */
    const directionalLight = new THREE.DirectionalLight('#b9d5ff', 0.3);
    directionalLight.position.set(4, 5, -2);
    scene.add(directionalLight);

    /* 相机 */
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(5, 5, 10);
    camera.lookAt(0, 0, 0);

    /* 控制器 */
    const controls = new OrbitControls(camera, canvasRef.current);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 0, 0);
    controls.update();

    /* 世界坐标辅助器 */
    const axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);

    /* 地板 */
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: '#a9c388' }))
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    /* 房子 */
    const house = new THREE.Group();
    scene.add(house);

    /* 墙壁 */
    const walls = new THREE.Mesh(new THREE.BoxGeometry(4, 2.5, 4), new THREE.MeshStandardMaterial({ color: '#ac8e82' }))
    walls.position.y = 2.5 / 2;
    house.add(walls);

    /* 屋顶 */
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.5, 1, 4), new THREE.MeshStandardMaterial({ color: '#b35f45' }))
    roof.position.y = 2.5 + 0.5;
    roof.rotation.y = Math.PI / 4;
    house.add(roof);

    /* 门 */
    const door = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshStandardMaterial({ color: '#aa7b7b' }))
    door.position.y = 1
    door.position.z = 2 + 0.01
    house.add(door)

    /* 门的灯 */
    const doorLight = new THREE.PointLight('#ff7d46', 1, 7);
    doorLight.position.set(0, 2.2, 2.7);
    house.add(doorLight);

    /* 灌木丛 */
    const bushGeometry = new THREE.SphereGeometry(1, 16, 16)
    const bushMaterial = new THREE.MeshStandardMaterial({ color: '#89c854' })

    const bush1 = new THREE.Mesh(bushGeometry, bushMaterial)
    bush1.scale.set(0.5, 0.5, 0.5)
    bush1.position.set(0.8, 0.2, 2.2)


    const bush2 = new THREE.Mesh(bushGeometry, bushMaterial)
    bush2.scale.set(0.25, 0.25, 0.25)
    bush2.position.set(1.4, 0.1, 2.1)

    const bush3 = new THREE.Mesh(bushGeometry, bushMaterial)
    bush3.scale.set(0.4, 0.4, 0.4)
    bush3.position.set(-0.8, 0.1, 2.2)

    const bush4 = new THREE.Mesh(bushGeometry, bushMaterial)
    bush4.scale.set(0.15, 0.15, 0.15)
    bush4.position.set(-1, 0.05, 2.6)

    scene.add(bush1, bush2, bush3, bush4)

    /* 坟墓 */
    const graves = new THREE.Group()
    scene.add(graves)

    const graveGeometry = new THREE.BoxGeometry(0.6, 0.8, 0.2)
    const graveMaterial = new THREE.MeshStandardMaterial({
      color: '#b2b6b1'
    })

    for (let i = 0; i < 50; i++) {

      const angle = Math.random() * Math.PI * 2
      const radius = 3 + Math.random() * 6

      const x = Math.sin(angle) * radius
      const z = Math.cos(angle) * radius
      const grave = new THREE.Mesh(graveGeometry, graveMaterial)
      grave.position.set(x, 0, z)
      grave.rotation.y = (Math.random() - 0.5) * 0.4
      grave.rotation.z = (Math.random() - 0.5) * 0.4
      grave.castShadow = true
      graves.add(grave)
    }

    /* 幽灵 */
    const ghost1 = new THREE.PointLight('#ff00ff', 2, 3)
    scene.add(ghost1)

    const ghost2 = new THREE.PointLight('#00ffff', 2, 3)
    scene.add(ghost2)

    const ghost3 = new THREE.PointLight('#ffff00', 2, 3)
    scene.add(ghost3)


    /* 纹理 */

    const textureLoader = new THREE.TextureLoader()
    const doorColorTexture = textureLoader.load(window.$$prefix + '/textures/door.png')
    const wallColorTexture = textureLoader.load(window.$$prefix + '/textures/wall.png')
    const floorColorTexture = textureLoader.load(window.$$prefix + '/textures/floor.png')

    floor.material.map = floorColorTexture
    door.material.map = doorColorTexture
    walls.material.map = wallColorTexture

    /* 阴影 */
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap

    floor.receiveShadow = true

    walls.castShadow = true
    door.castShadow = true

    directionalLight.castShadow = true
    doorLight.castShadow = true

    bush1.castShadow = true
    bush2.castShadow = true
    bush3.castShadow = true
    bush4.castShadow = true

    ghost1.castShadow = true
    ghost2.castShadow = true
    ghost3.castShadow = true

    doorLight.shadow.mapSize.width = 256
    doorLight.shadow.mapSize.height = 256
    doorLight.shadow.camera.far = 7

    ghost1.shadow.mapSize.width = 256
    ghost1.shadow.mapSize.height = 256
    ghost1.shadow.camera.far = 7

    ghost2.shadow.mapSize.width = 256
    ghost2.shadow.mapSize.height = 256
    ghost2.shadow.camera.far = 7

    ghost3.shadow.mapSize.width = 256
    ghost3.shadow.mapSize.height = 256
    ghost3.shadow.camera.far = 7

    // 窗口大小调整
    const handleResize = () => {
      if (!canvasRef.current) return;

      const { clientWidth: width, clientHeight: height } = canvasRef.current;

      if (renderer.domElement.width !== width || renderer.domElement.height !== height) {

        renderer.setSize(width, height, false);

        camera.aspect = width / height;

        camera.updateProjectionMatrix();
      }
    };

    function render(time: number) {
      const seconds = time * 0.001;

      /* update ghosts */

      const ghost1Angle = seconds * 0.5;
      ghost1.position.x = Math.cos(ghost1Angle) * 4;
      ghost1.position.z = Math.sin(ghost1Angle) * 4;
      ghost1.position.y = Math.sin(seconds * 3);

      const ghost2Angle = seconds * 0.32;
      ghost2.position.x = Math.cos(ghost2Angle) * 5;
      ghost2.position.z = Math.sin(ghost2Angle) * 5;
      ghost2.position.y = Math.sin(seconds * 4) + Math.sin(seconds * 2.5);

      const ghost3Angle = -seconds * 0.14;
      ghost3.position.x = Math.cos(ghost3Angle) * (7 + Math.sin(seconds * 0.32));
      ghost3.position.z = Math.sin(ghost3Angle) * (7 + Math.sin(seconds * 0.35));
      ghost3.position.y = Math.sin(seconds * 3) + Math.sin(seconds * 2);

      handleResize();

      controls.update();

      renderer.render(scene, camera);

      requestAnimationFrame(render);
    }

    requestAnimationFrame(render);

    window.addEventListener('resize', handleResize);

    return () => {

      renderer.dispose();
      window.removeEventListener('resize', handleResize);

    }
  }

  useEffect(() => {
    const cleanup = initScene();

    return cleanup;
  }, []);

  return <div className='canvas-container'>

    <canvas className='canvas-body' ref={canvasRef}></canvas>

  </div>

}

export default HauntdHouse