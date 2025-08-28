import React, { useEffect, useRef } from 'react'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import * as THREE from 'three'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { GUI } from "three/examples/jsm/libs/lil-gui.module.min.js";
import { color } from 'three/tsl'

type TankPropsType = {

}

const Tank: React.FC<TankPropsType> = (props) => {

  const { } = props

  const canvas = useRef<HTMLCanvasElement>(null)

  const guiRef = useRef<GUI>(null);

  const main = () => {

    const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: canvas.current! });
    renderer.setClearColor('#d4d4d4', 0.5);
    renderer.shadowMap.enabled = true;

    const scene = new THREE.Scene();

    // 创建相机
    function makeCamera(fov = 40) {

      const aspect = 2; // the canvas default
      const zNear = 0.1;
      const zFar = 1000;
      return new THREE.PerspectiveCamera(fov, aspect, zNear, zFar);

    }

    // 场景相机
    const camera = makeCamera();
    camera.position.set(8, 4, 10).multiplyScalar(3);
    camera.lookAt(0, 0, 0);

    // 坐标系
    const axes = new THREE.AxesHelper(5);
    scene.add(axes);


    // 绘制地板
    {

      const groundGeometry = new THREE.PlaneGeometry(109, 100);
      const groundMaterial = new THREE.MeshPhongMaterial({ color: '#eb9d76' });
      const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
      groundMesh.rotation.x = Math.PI * - .5;

      // 是否展示物体投影
      groundMesh.receiveShadow = true;
      scene.add(groundMesh);
    }

    // 第一个定向光源
    {
      const light = new THREE.DirectionalLight('#fff', 3);
      light.position.set(0, 20, 0);
      scene.add(light);

      // 光源指示器
      const helper = new THREE.DirectionalLightHelper(light, 5);
      scene.add(helper);

      // 是否展示物体投影
      light.castShadow = true;
      light.shadow.mapSize.width = 2048;
      light.shadow.mapSize.height = 2048;

      const d = 50;
      light.shadow.camera.left = - d;
      light.shadow.camera.right = d;
      light.shadow.camera.top = d;
      light.shadow.camera.bottom = - d;
      light.shadow.camera.near = 1;
      light.shadow.camera.far = 50;
      light.shadow.bias = 0.01;
    }

    // 第二个定向光源
    {
      const light = new THREE.DirectionalLight('#fff', 3);
      light.position.set(1, 2, 4);
      scene.add(light);

      // 光源指示器
      /*       const helper = new THREE.DirectionalLightHelper(light, 5);
            scene.add(helper); */
    }

    // 绘制坦克
    const tank = new THREE.Object3D();
    scene.add(tank);

    const carWidth = 4;
    const carHeight = 1;
    const carLength = 8;

    // 绘制坦克的身体
    const bodyGeometry = new THREE.BoxGeometry(carWidth, carHeight, carLength);
    const bodyMaterial = new THREE.MeshPhongMaterial({ color: '#769dc1' });
    const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    bodyMesh.position.y = 1.4;
    bodyMesh.castShadow = true;
    tank.add(bodyMesh);

    // 绘制坦克的camera
    const tankCameraFov = 75;
    const tankCamera = makeCamera(tankCameraFov);
    tankCamera.position.y = 3;
    tankCamera.position.z = -6;
    tankCamera.rotation.y = Math.PI / 180 * 180;
    bodyMesh.add(tankCamera);

    // 绘制坦克的轮子

    const wheelRadius = 1;
    const wheelThickness = .5;
    const wheelSegments = 6;
    const wheelGeometry = new THREE.CylinderGeometry(
      wheelRadius, // top radius
      wheelRadius, // bottom radius
      wheelThickness, // height of cylinder
      wheelSegments);


    const wheelPositions = [
      {
        color: '#006afd',
        colorName: '蓝色',
        position: [- carWidth / 2 - wheelThickness / 2, - carHeight / 2, carLength / 3],
      },

      {
        color: '#fd6e00',
        colorName: '橙色',
        position: [carWidth / 2 + wheelThickness / 2, - carHeight / 2, carLength / 3],
      },

      {
        color: '#4dff00',
        colorName: '绿色',
        position: [- carWidth / 2 - wheelThickness / 2, - carHeight / 2, 0],
      },

      {
        color: '#6f00ff',
        colorName: '紫色',
        position: [carWidth / 2 + wheelThickness / 2, - carHeight / 2, 0],
      },


      {
        color: '#ff0000',
        colorName: '红色',
        position: [- carWidth / 2 - wheelThickness / 2, - carHeight / 2, - carLength / 3],
      },

      {
        color: '#ff0084',
        colorName: '粉色',
        position: [carWidth / 2 + wheelThickness / 2, - carHeight / 2, - carLength / 3],
      },


    ];

    console.log(wheelPositions);

    const wheelMeshes = wheelPositions.map((item) => {
      const wheelMaterial = new THREE.MeshPhongMaterial({ color: item.color });

      const mesh = new THREE.Mesh(wheelGeometry, wheelMaterial);

      mesh.position.set(...item.position as [number, number, number]);

      mesh.rotation.z = Math.PI * .5;

      mesh.castShadow = true;

      bodyMesh.add(mesh);

      return mesh;

    });

    // 绘制炮台
    const domeRadius = 2;
    const domeWidthSubdivisions = 12;
    const domeHeightSubdivisions = 12;
    const domePhiStart = 0;
    const domePhiEnd = Math.PI * 2;
    const domeThetaStart = 0;
    const domeThetaEnd = Math.PI * .5;
    const domeGeometry = new THREE.SphereGeometry(
      domeRadius, domeWidthSubdivisions, domeHeightSubdivisions,
      domePhiStart, domePhiEnd, domeThetaStart, domeThetaEnd);

    const domeMesh = new THREE.Mesh(domeGeometry, bodyMaterial);
    domeMesh.castShadow = true;
    bodyMesh.add(domeMesh);
    domeMesh.position.y = 0.5;

    // 绘制炮管
    const turretWidth = .1;
    const turretHeight = .1;
    const turretLength = carLength * .75 * .2;
    const turretGeometry = new THREE.BoxGeometry(
      turretWidth, turretHeight, turretLength);
    const turretMesh = new THREE.Mesh(turretGeometry, bodyMaterial);

    const turretPivot = new THREE.Object3D();
    turretMesh.castShadow = true;
    turretPivot.scale.set(5, 5, 5);

    turretPivot.position.y = .5;
    turretMesh.position.z = turretLength * 0.5;

    turretPivot.add(turretMesh);
    bodyMesh.add(turretPivot);

    // 绘制炮管camera
    const turretCamera = makeCamera();
    turretCamera.position.y = .75 * .2;
    turretMesh.add(turretCamera);

    // 绘制目标
    const targetGeometry = new THREE.SphereGeometry(.5, 6, 3);
    const targetMaterial = new THREE.MeshPhongMaterial({ color: 0x00FF00, flatShading: true });
    const targetMesh = new THREE.Mesh(targetGeometry, targetMaterial);

    const targetOrbit = new THREE.Object3D();
    const targetElevation = new THREE.Object3D();
    const targetBob = new THREE.Object3D();

    targetMesh.castShadow = true;

    scene.add(targetOrbit);

    targetOrbit.add(targetElevation);

    targetElevation.position.z = carLength * 2;
    targetElevation.position.y = 8;

    targetElevation.add(targetBob);
    targetBob.add(targetMesh);

    // 绘制目标相机
    const targetCamera = makeCamera();
    const targetCameraPivot = new THREE.Object3D();
    targetCamera.position.y = 1;
    targetCamera.position.z = - 2;
    targetCamera.rotation.y = Math.PI;
    targetBob.add(targetCameraPivot);
    targetCameraPivot.add(targetCamera);


    // Create a sine-like wave
    const curve = new THREE.SplineCurve([
      new THREE.Vector2(- 10, 0),
      new THREE.Vector2(- 5, 5),
      new THREE.Vector2(0, 0),
      new THREE.Vector2(5, - 5),
      new THREE.Vector2(10, 0),
      new THREE.Vector2(5, 10),
      new THREE.Vector2(- 5, 10),
      new THREE.Vector2(- 10, - 10),
      new THREE.Vector2(- 15, - 8),
      new THREE.Vector2(- 10, 0),
    ]);

    const points = curve.getPoints(50);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
    const splineObject = new THREE.Line(geometry, material);
    splineObject.rotation.x = Math.PI * .5;
    splineObject.position.y = 0.05;
    scene.add(splineObject);

    const cameras = [
      { cam: camera, desc: 'detached camera', },
      { cam: tankCamera, desc: 'above back of tank', },
      { cam: turretCamera, desc: 'on turret looking at target', },
      { cam: targetCamera, desc: 'near target looking at tank', },
    ];

    // gui工具
    if (!!guiRef.current) {
      guiRef.current.destroy();
      guiRef.current = null;
    }

    guiRef.current = new GUI();

    const cameraGuiControls = {
      activeCameraIndex: 0,
    };

    const cameraGuiControlsOptions = {};

    // 相机控制参数
    cameras.forEach((camera, index) => {
      // @ts-ignore
      cameraGuiControlsOptions[`相机${index + 1}`] = index;
    });


    guiRef
      .current!.add(cameraGuiControls, "activeCameraIndex")
      .options(cameraGuiControlsOptions)
      .name("切换相机视角")
      .onChange((val) => {
        cameraGuiControls.activeCameraIndex = val as number;
      });


    // 提取尺寸调整逻辑为独立函数
    const handleResize = () => {
      if (!renderer || !camera || !canvas.current) return

      const canvasElement = canvas.current
      const width = canvasElement.clientWidth
      const height = canvasElement.clientHeight

      // 检查是否需要调整尺寸
      if (canvasElement.width !== width || canvasElement.height !== height) {
        // 设置渲染器尺寸（第三个参数false确保不扭曲像素）
        renderer.setSize(width, height, false)
        const canvas = renderer.domElement;

        cameras.forEach((cameraInfo) => {

          const camera = cameraInfo.cam;
          camera.aspect = canvas.clientWidth / canvas.clientHeight;
          camera.updateProjectionMatrix();

        });
      }
    }

    // 初始强制调整一次尺寸（关键修复）
    handleResize()

    const targetPosition = new THREE.Vector3();
    const tankPosition = new THREE.Vector2();
    const tankTarget = new THREE.Vector2();


    function render(time: number) {
      if (!canvas.current) return

      time *= 0.001;

      handleResize()

      // move target
      targetOrbit.rotation.y = time * .27;
      targetBob.position.y = Math.sin(time * 2) * 4;
      targetMesh.rotation.x = time * 7;
      targetMesh.rotation.y = time * 13;
      targetMaterial.emissive.setHSL(time * 10 % 1, 1, .25);
      targetMaterial.color.setHSL(time * 10 % 1, 1, .25);

      // move tank
      /*       const tankTime = time * .05;
            curve.getPointAt(tankTime % 1, tankPosition);
            curve.getPointAt((tankTime + 0.01) % 1, tankTarget);
            tank.position.set(tankPosition.x, 0, tankPosition.y);
            tank.lookAt(tankTarget.x, 0, tankTarget.y); */

      // face turret at target
      targetMesh.getWorldPosition(targetPosition);
      turretPivot.lookAt(targetPosition);

      // make the turretCamera look at target
      turretCamera.lookAt(targetPosition);

      // make the targetCameraPivot look at the at the tank
      tank.getWorldPosition(targetPosition);
      targetCameraPivot.lookAt(targetPosition);

      wheelMeshes.forEach((obj) => {
        obj.rotation.x = time * 3;
      });

      renderer.render(scene, cameras[cameraGuiControls.activeCameraIndex].cam);

      requestAnimationFrame(render);

    }

    requestAnimationFrame(render);

  }

  useEffect(() => {
    if (canvas.current) {
      main();
    }

    return () => {
      guiRef.current?.destroy();
    }
  }, [])

  return <div className="canvas-container" >
    {/* 确保canvas占满容器 */}
    <canvas
      className="canvas-body"
      ref={canvas}
    ></canvas>
  </div>

}

export default Tank