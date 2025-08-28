import React, { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GUI } from "three/examples/jsm/libs/lil-gui.module.min.js";
import { Font, FontLoader, TextGeometry } from "three/examples/jsm/Addons.js";

type GroundPropsType = {};

const Ground: React.FC<GroundPropsType> = (props) => {
  const { } = props;

  const canvas = useRef<HTMLCanvasElement>(null);
  const guiRef = useRef<GUI>(null);
  // 存储carGroup引用以便在整个组件中访问
  const carGroupRef = useRef<THREE.Group>(null);

  const main = async () => {
    // 创建渲染器
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      canvas: canvas.current!,
    });

    // 创建场景
    const scene = new THREE.Scene();

    const cameraParams = [
      {
        fov: 45,
        aspect: 1,
        near: 0.1,
        far: 1000,
        position: { x: 0, y: 30, z: 60 },
        userData: {
          name: "camera1",
        },
      },
      {
        fov: 45,
        aspect: 1,
        near: 0.1,
        far: 1000,
        position: { x: 0, y: 30, z: -60 },
        userData: {
          name: "camera2",
        },
      },
      {
        fov: 45,
        aspect: 1,
        near: 0.1,
        far: 1000,
        position: { x: -20, y: 10, z: 50 },
        userData: {
          name: "camera3",
        },
      },
      {
        fov: 45,
        aspect: 1,
        near: 0.1,
        far: 1000,
        // 调整初始位置，离车更远一些
        position: { x: 0, y: 8, z: 40 },
        userData: {
          name: "camera4",
        },
      },
    ];

    const cameraInstanceList = cameraParams.map((item) => {
      const camera = new THREE.PerspectiveCamera(
        item.fov,
        item.aspect,
        item.near,
        item.far
      );

      camera.position.z = item.position.z;
      camera.position.y = item.position.y;
      camera.position.x = item.position.x;

      // 自定义数据
      camera.userData = item.userData;
      return camera;
    });

    const controlsInstanceList = cameraInstanceList.map((item) => {
      const controls = new OrbitControls(item, canvas.current!);

      controls.autoRotate = false;
      // 设置带阻尼的惯性
      controls.enableDamping = true
      // 设置阻尼系数
      controls.dampingFactor = 0.05

      controls.target.set(0, 0, 0);
      return controls;
    });

    // 定向光源
    const color = "rgba(101, 101, 101)";
    const intensity = 10;
    const light = new THREE.DirectionalLight(color, intensity);
    light.position.set(0, 10, 10);
    scene.add(light);

    // 光源指示器
    const helper = new THREE.DirectionalLightHelper(light);
    helper.color = "rgba(255, 255, 255)";
    scene.add(helper);

    const prefix = import.meta.env.PROD ? '/three.js' : ''

    // 创建3d文字
    {
      const loader = new FontLoader();

      function loadFont(url: string) {
        return new Promise((resolve, reject) => {
          loader.load(url, resolve, undefined, reject);
        });
      }

      const font = (await loadFont(
        prefix + "/helvetiker_regular.typeface.json"
      )) as Font;

      const geometry = new TextGeometry("three.js", {
        font: font,
        size: 3.0,
        depth: 0.2,
        curveSegments: 12,
        bevelEnabled: true,
        bevelThickness: 0.15,
        bevelSize: 0.3,
        bevelSegments: 5,
      });

      const textMaterial = new THREE.MeshPhongMaterial({
        side: THREE.DoubleSide,
        color: "#00b96b",
      });

      const mesh = new THREE.Mesh(geometry, textMaterial);
      geometry.computeBoundingBox();
      geometry.boundingBox!.getCenter(mesh.position).multiplyScalar(-1);

      const parent = new THREE.Object3D();
      parent.add(mesh);
      parent.position.y = 10;
      scene.add(parent);
    }

    // 绘制地面
    {
      const planeSize = 40;
      const loader = new THREE.TextureLoader();


      const texture = loader.load(prefix + "/checker.png");
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.magFilter = THREE.NearestFilter;
      texture.colorSpace = THREE.SRGBColorSpace;
      const repeats = planeSize / 2;
      texture.repeat.set(repeats, repeats);

      const planeGeo = new THREE.PlaneGeometry(planeSize, planeSize);
      const planeMat = new THREE.MeshPhongMaterial({
        map: texture,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(planeGeo, planeMat);
      mesh.rotation.x = Math.PI * -0.5;
      scene.add(mesh);
    }

    // 车子
    const boxGeometry = new THREE.BoxGeometry(5, 2, 3);
    const boxMaterial = new THREE.MeshPhongMaterial({ color: "#8AC" });
    const box = new THREE.Mesh(boxGeometry, boxMaterial);

    const boxInitX = 0;
    const boxInitY = 2;
    const boxInitZ = 20;

    box.position.set(boxInitX, boxInitY, boxInitZ);
    box.rotation.y = (Math.PI / 180) * 90;

    const carGroup = new THREE.Group();
    carGroup.position.z = 10;
    carGroup.add(box);
    const camera4 = cameraInstanceList[3];
    // 相机看向车辆前方（相对于车辆组的本地坐标）
    camera4.lookAt(new THREE.Vector3(0, 1, -30));
    // 关键步骤：将相机4添加到车辆组，成为其子对象
    carGroup.add(camera4);
    // 保存carGroup引用
    carGroupRef.current = carGroup;

    // 轮子
    const wheelPosition = [
      [-1.6, 1, 18],
      [1.6, 1, 18],
      [-1.6, 1, 22],
      [1.6, 1, 22],
    ];

    const wheelInstanceList = wheelPosition.map((item, index) => {
      const geometry = new THREE.CylinderGeometry(1, 1, 0.5, 32);
      const material = new THREE.MeshPhongMaterial({ color: 0xffff00 });
      const cylinder = new THREE.Mesh(geometry, material);
      cylinder.rotation.z = (Math.PI / 180) * 90;
      cylinder.position.set(item[0], item[1], item[2]);
      carGroup.add(cylinder);
      return cylinder;
    });

    scene.add(carGroup);

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
    cameraParams.forEach((camera, index) => {
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

    function resizeRendererToDisplaySize(renderer: THREE.WebGLRenderer) {
      const canvas = renderer.domElement;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const needResize = canvas.width !== width || canvas.height !== height;

      if (needResize) {
        renderer.setSize(width, height, false);
      }

      return needResize;
    }

    function render(time: number) {
      const seconds = time * 0.001; // 将毫秒转换为秒

      if (resizeRendererToDisplaySize(renderer)) {
        const canvas = renderer.domElement;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;

        const min = Math.min(width, height);
        const left = (width - min) / 2;
        const bottom = (height - min) / 2;

        renderer.setSize(width, height, false);
        renderer.setViewport(left, bottom, min, min);

        cameraInstanceList.forEach((cameraInstance) => {
          cameraInstance.aspect = 1; // 固定为1
          cameraInstance.updateProjectionMatrix();
        });
      }

      // 车辆移动逻辑
      carGroup.position.z =
        -(seconds * ((Math.PI / 180) * 100));

      // 相机跟随逻辑
      cameraInstanceList.forEach((cameraInstance, index) => {

        if (index === 3 && cameraGuiControls.activeCameraIndex === index) {
          const car = carGroupRef.current;

          // 只处理camera4且当前激活的是camera4时
          if (
            cameraInstance.userData.name === "camera4" &&
            cameraGuiControls.activeCameraIndex === 3
          ) {
            const car = carGroupRef.current;
            if (car) {
              /*            // 调整相机位置，保持在车后方合适距离，提高y值获得更好视角
                         cameraInstance.position.x = car.position.x;
                         cameraInstance.position.y = car.position.y + 8; // 提高相机高度
                         cameraInstance.position.z = car.position.z + 40; // 增加与车的距离  
                         // 相机目标点设置为车的位置，而不是相机自身位置
                         controlsInstanceList[index].target.x = car.position.x;
                         controlsInstanceList[index].target.y = car.position.y + 5; // 稍微高于车底
                         controlsInstanceList[index].target.z = car.position.z + 30; 
                         controlsInstanceList[index].update();
                         cameraInstance.updateProjectionMatrix(); */
            }
          }
        }

      });

      const camera = cameraInstanceList[cameraGuiControls.activeCameraIndex];
      helper.update();
      renderer.render(scene, camera);
      requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
  };

  useEffect(() => {
    main();

    return () => {
      if (guiRef.current) {
        guiRef.current.destroy();
        guiRef.current = null;
      }
    };
  }, []);

  return (
    <div className="canvas-container">
      <canvas className="canvas-body" ref={canvas}></canvas>
    </div>
  );
};

export default Ground;