import React, { useRef, useEffect } from 'react';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as THREE from 'three';
import SpriteText from "three-spritetext";
import { Water } from 'three/examples/jsm/objects/Water.js'

type EarthConstructPropsType = {};

// 1. 标签参数类型（label偏移和target偏移完全拆分）
type LabelOptions = {
  text: string; // 标签文字
  textSize: number; // 文字大小
  textBgColor: string; // 文字背景色
  lineColor: string; // 引线颜色
  baseTargetPos: THREE.Vector3; // 目标点基础位置（未加偏移）
  earthRadius: number; // 地球半径（用于标签x轴基础偏移）
  labelOffset: { x: number; y: number; z: number }; // 标签自身偏移（相对目标点，默认全0）
  targetOffset: { x: number; y: number; z: number }; // 目标点自身偏移（相对baseTargetPos，默认全0）
};

// 2. 地幔分层参数类型（createCircle的对象参数）
type CircleOptions = {
  radius: number; // 地幔半径
  color: string; // 地幔颜色
  position: { x: number; y: number; z: number }; // 地幔组基础位置
  metalness: number; // 金属度
  roughness: number; // 粗糙度
  name: string; // 地幔名称
  labelOffset?: { x: number; y: number; z: number }; // 标签偏移（传给createLabelWithLine）
  targetOffset?: { x: number; y: number; z: number }; // 目标点偏移（传给createLabelWithLine）
};

const EarthConstruct: React.FC<EarthConstructPropsType> = (props) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const labelGroupsRef = useRef<THREE.Group[]>([]);

  const oceanRef = useRef<THREE.Mesh | null>(null);

  const main = () => {
    if (!canvas.current) return;

    // 1. 初始化渲染器
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      canvas: canvas.current,
    });
    rendererRef.current = renderer;
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.localClippingEnabled = true;

    // 2. 相机设置
    const fov = 75;
    const aspect = window.innerWidth / window.innerHeight;
    const near = 0.1;
    const far = 1000;
    const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    camera.position.set(6, 2, 12);

    // 3. 场景与光源
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#333333');

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
    dirLight.position.set(-6, 8, 6);
    scene.add(dirLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);

    // 4. 裁剪平面设置
    const clipPlanes = [
      new THREE.Plane(new THREE.Vector3(-3, 0, 0), 0),
      new THREE.Plane(new THREE.Vector3(0, -3, 0), 0),
      new THREE.Plane(new THREE.Vector3(0, 0, -3), 0)
    ];

    // 5. 地球外层（地壳）
    const earthGroup = new THREE.Group();
    const earthRadius = 3;
    const earthGeometry = new THREE.SphereGeometry(earthRadius, 64, 32);
    const earthMaterial = new THREE.MeshStandardMaterial({
      map: new THREE.TextureLoader().load(window.$$prefix + '/models/earth/textures/Material.002_diffuse.jpg'),
      side: THREE.DoubleSide,
      clippingPlanes: clipPlanes,
      clipIntersection: true,
      metalness: 0.2,
      roughness: 0.6,
    });
    const earth = new THREE.Mesh(earthGeometry, earthMaterial);
    earth.renderOrder = 0;
    earthGroup.add(earth);
    scene.add(earthGroup);

    // ======================================
    // createLabelWithLine（label和target偏移完全拆分）
    // ======================================
    const createLabelWithLine = (options: LabelOptions) => {
      // 解构参数（必选参数+默认值）
      const {
        text,
        textSize,
        textBgColor,
        lineColor,
        baseTargetPos,
        earthRadius,
        labelOffset = { x: 0, y: 0, z: 0 }, // 标签自身偏移（默认全0）
        targetOffset = { x: 0, y: 0, z: 0 }  // 目标点自身偏移（默认全0）
      } = options;

      // 1. 创建标签+引线组
      const labelGroup = new THREE.Group();
      labelGroupsRef.current.push(labelGroup);

      // 2. 计算最终目标点（基础位置 + 目标点偏移）
      const finalTargetPos = new THREE.Vector3(
        baseTargetPos.x + targetOffset.x,
        baseTargetPos.y + targetOffset.y,
        baseTargetPos.z + targetOffset.z
      );

      // 3. 计算标签位置（目标点 + 地球半径偏移 + 标签自身偏移）
      const labelPos = new THREE.Vector3(
        finalTargetPos.x + earthRadius + labelOffset.x, // 地球半径基础偏移 + 标签x偏移
        finalTargetPos.y + labelOffset.y, // 标签y偏移
        finalTargetPos.z + labelOffset.z  // 标签z偏移
      );

      // 4. 创建文字标签
      const spriteText = new SpriteText(text, textSize, '#ffffff');
      spriteText.backgroundColor = textBgColor;
      spriteText.padding = [0.05, 0.05];
      spriteText.borderRadius = 0.05;
      spriteText.position.copy(labelPos);
      labelGroup.add(spriteText);

      // 5. 创建引线
      const lineGeometry = new THREE.BufferGeometry();
      const linePoints = [
        labelPos.x, labelPos.y - textSize / 6, labelPos.z, // 引线起点（文字底部）
        finalTargetPos.x, finalTargetPos.y, finalTargetPos.z // 引线终点（最终目标点）
      ];
      lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePoints, 3));

      const lineMaterial = new THREE.LineBasicMaterial({
        color: lineColor,
        linewidth: 5,
        side: THREE.DoubleSide,
      });
      const line = new THREE.LineSegments(lineGeometry, lineMaterial);
      line.renderOrder = 0.5;
      labelGroup.add(line);

      scene.add(labelGroup);
      return labelGroup;
    };

    // ======================================
    // createCircle（参数改为对象形式）
    // ======================================
    const createCircle = (options: CircleOptions) => {
      // 解构地幔参数
      const {
        radius,
        color,
        position,
        metalness,
        roughness,
        name,
        labelOffset = { x: 0, y: 0, z: 0 }, // 标签偏移默认值
        targetOffset = { x: 0, y: 0, z: 0 }  // 目标点偏移默认值
      } = options;

      // 1. 创建地幔组（位置基于传入的position对象）
      const mantleGroup = new THREE.Group();
      mantleGroup.name = name;
      mantleGroup.renderOrder = 1;
      mantleGroup.position.set(position.x, position.y, position.z); // 应用基础位置

      // 2. 创建地幔平面
      const circleGeometry = new THREE.CircleGeometry(radius, 64);
      const mantleMaterial = new THREE.MeshStandardMaterial({
        color: color,
        side: THREE.DoubleSide,
        metalness: metalness,
        roughness: roughness,
      });

      const mantleXY = new THREE.Mesh(circleGeometry, mantleMaterial);
      mantleXY.name = `${name}-XY`;
      mantleGroup.add(mantleXY);

      const mantleYZ = new THREE.Mesh(circleGeometry, mantleMaterial);
      mantleYZ.rotation.x = Math.PI / 2;
      mantleYZ.name = `${name}-YZ`;
      mantleGroup.add(mantleYZ);

      const mantleXZ = new THREE.Mesh(circleGeometry, mantleMaterial);
      mantleXZ.rotation.y = Math.PI / 2;
      mantleXZ.name = `${name}-XZ`;
      mantleGroup.add(mantleXZ);

      scene.add(mantleGroup);

      // 3. 为地幔创建标签+引线（传递拆分后的偏移参数）
      createLabelWithLine({
        text: name,
        textSize: 0.25,
        textBgColor: color,
        lineColor: '#fff',
        // 地幔目标点基础位置（组位置 + 半径，y轴方向）
        baseTargetPos: new THREE.Vector3(position.x, position.y + radius, position.z),
        earthRadius: earthRadius,
        labelOffset: labelOffset, // 标签自身偏移（来自createCircle参数）
        targetOffset: targetOffset // 目标点自身偏移（来自createCircle参数）
      });

      return mantleGroup;
    };

    // ======================================
    // 调用createCircle（参数对象化）
    // ======================================
    createCircle({
      radius: earthRadius,
      color: 'rgba(50, 171, 219, 1)',
      position: { x: 0, y: 0, z: 0 },
      metalness: 0.15,
      roughness: 0.7,
      name: '地壳',
      labelOffset: { x: -1, y: 0.25, z: 0 }, // 标签自身偏移
      targetOffset: { x: 0, y: -0.025, z: 0.1 }    // 目标点偏移（默认）
    });

    createCircle({
      radius: 2.95,
      color: 'rgba(252, 94, 18, 1)',
      position: { x: 0.001, y: 0.001, z: 0.001 },
      metalness: 0.2,
      roughness: 0.65,
      name: '软流层',
      labelOffset: { x: -1, y: 0, z: 0 },
      targetOffset: { x: 0, y: -0.2, z: 0.1 }    // 目标点偏移（默认）
    });

    createCircle({
      radius: 2.55,
      color: 'rgba(252, 221, 59, 1)',
      position: { x: 0.002, y: 0.002, z: 0.002 },
      metalness: 0.25,
      roughness: 0.6,
      name: '地幔',
      labelOffset: { x: -0.1, y: 0, z: 0 },
      targetOffset: { x: 0, y: -0.2, z: 0.1 }    // 目标点偏移（默认）
    });

    createCircle({
      radius: 2.15,
      color: 'rgba(202, 52, 15, 1)',
      position: { x: 0.003, y: 0.003, z: 0.003 },
      metalness: 0.3,
      roughness: 0.55,
      name: '外核',
      labelOffset: { x: 0.1, y: 0, z: 0 },
      targetOffset: { x: 0, y: -0.5, z: 0.1 }    // 目标点偏移（默认）
    });

    // ======================================
    // 地核（参数对象化调用标签函数）
    // ======================================
    const coreRadius = 1;
    const coreColor = 'rgba(156, 35, 31, 1)';
    const earthCoreGeometry = new THREE.SphereGeometry(coreRadius, 64, 32);
    /*     const earthCoreMaterial = new THREE.MeshStandardMaterial({
          side: THREE.DoubleSide,
          map: new THREE.TextureLoader().load(window.$$prefix + '/models/sun/textures/moon_baseColor.jpeg'),
          metalness: 0.1,
          roughness: 0.5,
        }); */

    const earthCoreMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vertexUV;
        varying vec3 vertexNormal;

        void main() {
          vertexUV = uv;
          vertexNormal = normal;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
       `,
      fragmentShader: `
       uniform sampler2D globaTexture;
       varying vec2 vertexUV; // [0,0.24]
       varying vec3 vertexNormal;

        void main() {
          float intensity = 1.05 - dot(vertexNormal, vec3(0.0,0.0,1.0));
          vec3 atmosphere = vec3(1.0,0.0,0.0) * pow(intensity, 1.5);

          gl_FragColor = vec4(atmosphere + texture2D(globaTexture, vertexUV).xyz,1.0);
        }
       `,
      uniforms: {
        globaTexture: { value: new THREE.TextureLoader().load(window.$$prefix + '/models/sun/textures/moon_baseColor.jpeg') },
      },
    });
    const earthCore = new THREE.Mesh(earthCoreGeometry, earthCoreMaterial);
    earthCore.name = 'earth-core';
    earthCore.renderOrder = 2;
    scene.add(earthCore);

    // 2. 新增：炙热气体大气层（只包裹内核，动态效果）
    // 2.1 大气层材质（Shader实现气体渐变+波动）
    const hotGasMaterial = new THREE.ShaderMaterial({
      vertexShader: `
    uniform float time;
    varying vec3 vPosition;
    varying float vDistance; // 顶点到内核中心的距离（归一化）
    varying vec3 vNormal; // 传递法线，用于角度明暗变化

    float random(vec3 p) {
      return fract(sin(dot(p, vec3(12.9898, 78.233, 45.5432))) * 43758.5453);
    }

    void main() {
      vPosition = position;
      vNormal = normal;
      // 归一化距离：1.0（内核边缘）~ 1.15（大气层边缘）
      vDistance = length(position);

      // 顶点扰动（幅度降低，避免过度变形）
      float noise = random(position + time * 0.15) * 0.315;
      vec3 perturbedPos = position + normalize(position) * noise;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(perturbedPos, 1.0);
    }
  `,
      fragmentShader: `
    varying vec3 vPosition;
    varying float vDistance;
    varying vec3 vNormal;
    uniform float time;

    void main() {
      // --------------------------
      // 1. 优化的颜色梯度（自然过渡）
      // --------------------------
      vec3 gasColor;
      if (vDistance <= 1.05) { 
        // 内层（贴近内核）：深橙红（高温核心气体）
        gasColor = vec3(2.0, 0.5, 0.15); 
      } else if (vDistance <= 1.1) { 
        // 中层：亮橙（过渡层，衔接核心与外层）
        gasColor = mix(vec3(2.0, 0.5, 0.15), vec3(2.2, 0.8, 0.25), (vDistance - 1.05) / 0.05);
      } else { 
        // 外层：暖黄（外层气体，温度稍低）
        gasColor = mix(vec3(2.2, 0.8, 0.25), vec3(1.9, 1.1, 0.4), (vDistance - 1.1) / 0.05);
      }

      // --------------------------
      // 2. 角度明暗变化（更立体）
      // --------------------------
      float normalIntensity = 1.0 - dot(vNormal, vec3(0.0, 0.0, 1.0));
      gasColor *= (0.9 + normalIntensity * 0.3); // 正面稍亮，侧面稍暗

      // --------------------------
      // 3. 透明度与闪烁（柔和不刺眼）
      // --------------------------
      // 透明度梯度：内层0.7→外层0.2，避免外层过淡
      float alpha = 0.7 - (vDistance - 1.0) / 0.15 * 0.5;
      alpha = clamp(alpha, 0.2, 0.7);

      // 轻微闪烁（幅度降低，更自然）
      float flicker = sin(time * 2.5) * 0.08 + 0.96;
      gasColor *= flicker;

      // 最终颜色（叠加发光感）
      gl_FragColor = vec4(gasColor, alpha);
    }
  `,
      uniforms: {
        time: { value: 0.0 }, // 时间参数，在动画循环中更新
      },
      blending: THREE.AdditiveBlending, // 发光混合模式，增强炙热感
      side: THREE.FrontSide, // 只显示外层气体，避免内部重复
      depthWrite: false, // 关闭深度写入，不遮挡内核和其他层级
      transparent: true, // 启用透明度，实现渐变
    });

    // 2.2 大气层网格（半径比内核大15%，刚好包裹）
    const hotGasAtmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(coreRadius * 1.05, 64, 32), // 大气层半径=内核半径×1.15
      hotGasMaterial
    );
    hotGasAtmosphere.name = 'hot-gas-atmosphere';
    hotGasAtmosphere.renderOrder = 1.8; // 渲染顺序：在地幔（1）和内核（2）之间，确保在核外、幔内
    /*   scene.add(hotGasAtmosphere); */

    // 地核标签（拆分偏移参数）
    createLabelWithLine({
      text: '内核',
      textSize: 0.25,
      textBgColor: coreColor,
      lineColor: '#fff',
      baseTargetPos: new THREE.Vector3(0, coreRadius, 0), // 地核目标点基础位置
      earthRadius: earthRadius,
      labelOffset: { x: 0.4, y: 0, z: 0 }, // 标签自身偏移
      targetOffset: { x: 0, y: -0.5, z: 0.1 }    // 目标点偏移（默认）
    });

    // 8. 控制器
    const controls = new OrbitControls(camera, canvas.current);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = true;
    controls.maxDistance = 30;

    // 新增：Perlin噪声函数（生成自然起伏的高度数据）
    const perlinNoise = (x: number, y: number): number => {
      // 简化的2D噪声算法，生成-1~1之间的随机值，用于模拟地形起伏
      const hash = (n: number): number => Math.sin(n) * 43758.5453;
      const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);
      const lerp = (a: number, b: number, t: number): number => a + t * (b - a);
      const grad = (hash: number, x: number, y: number): number => {
        const h = hash & 7;
        const u = h < 4 ? x : y;
        const v = h < 4 ? y : x;
        return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
      };

      const ix = Math.floor(x);
      const iy = Math.floor(y);
      const fx = x - ix;
      const fy = y - iy;
      const fx1 = 1.0 - fx;
      const fy1 = 1.0 - fy;

      const p = hash(ix);
      const p1 = hash(ix + 1);
      const p2 = hash(p + iy);
      const p3 = hash(p1 + iy);
      const p4 = hash(p + iy + 1);
      const p5 = hash(p1 + iy + 1);

      const n0 = grad(p2, fx, fy);
      const n1 = grad(p3, fx1, fy);
      const n2 = grad(p4, fx, fy1);
      const n3 = grad(p5, fx1, fy1);

      const u = fade(fx);
      const v = fade(fy);
      return lerp(lerp(n0, n1, u), lerp(n2, n3, u), v);
    };

    const createBox = () => {
      const group = new THREE.Group();

      const boxWidth = 3;
      const boxHeight = 1.8;
      const boxDepth = 3;

      // 立方体线框（不变）
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth),
        new THREE.MeshBasicMaterial({ color: '#fff', wireframe: false, transparent: true, opacity: 0 })
      );
      group.add(box);
      box.position.set(-earthRadius * 1.5, 0, 4);

      const oceanAndLandHeight = 0.4;

      /* 创建海洋 */
      {
        const oceanWidth = boxWidth / 2;
        const oceanHeight = oceanAndLandHeight;
        const oceanDepth = boxDepth;

        const sun = new THREE.Vector3(2, 4, 1).add(box.position);

        const ocean = new Water(new THREE.BoxGeometry(oceanWidth, oceanHeight, oceanDepth), {
          waterNormals: new THREE.TextureLoader().load(window.$$prefix + '/water.jpg', function (texture) {
            texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
          }),
          sunDirection: sun,
          sunColor: '#2a8096',
          waterColor: '#3caffc',
          side: THREE.DoubleSide,
        });

        ocean.position.set(-boxWidth / 4, boxHeight / 2 - oceanHeight / 2, 0);
        oceanRef.current = ocean;
        box.add(ocean);
      }

      /* 创建带地形隆起的大陆（边缘不隆起） */
      {
        const landWidth = boxWidth / 2;
        const landHeight = oceanAndLandHeight; // 基础高度
        const landDepth = boxDepth;
        const maxElevation = 1.2; // 最大隆起高度
        const noiseScale = 6; // 噪声缩放（控制起伏密度）
        const edgeRatio = 0.01; // 边缘区域占比（10%宽度/深度为边缘，不隆起）

        // 1. 计算边缘范围（局部坐标系下）
        const halfWidth = landWidth / 2;
        const halfDepth = landDepth / 2;
        const edgeWidth = halfWidth * edgeRatio; // 边缘宽度（X方向）
        const edgeDepth = halfDepth * edgeRatio; // 边缘深度（Z方向）

        // 2. 创建基础几何体（增加分段数，确保边缘平滑）
        const landGeometry = new THREE.BoxGeometry(landWidth, landHeight, landDepth, 32, 8, 32);
        const vertices = landGeometry.attributes.position.array;

        // 3. 遍历顶部顶点，仅内部区域应用隆起
        for (let i = 0; i < vertices.length; i += 3) {
          const x = vertices[i]; // 顶点X坐标（局部坐标，范围：-halfWidth ~ halfWidth）
          const z = vertices[i + 2]; // 顶点Z坐标（范围：-halfDepth ~ halfDepth）
          const y = vertices[i + 1]; // 顶点Y坐标

          // 只处理顶部的顶点（Y接近基础高度的一半）
          if (y > landHeight / 2 - 0.01) {
            // 判断是否为边缘顶点（X或Z在边缘范围内）
            const isEdgeX = Math.abs(x) > halfWidth - edgeWidth; // X方向边缘
            const isEdgeZ = Math.abs(z) > halfDepth - edgeDepth; // Z方向边缘

            if (isEdgeX || isEdgeZ) {
              // 边缘顶点：保持原高度（不隆起）
              vertices[i + 1] = landHeight / 2;
            } else {
              // 内部顶点：计算隆起高度，并添加平滑过渡
              // 计算距离边缘的“内部占比”（0~1，越靠近中心越接近1）
              const innerRatioX = 1 - (Math.abs(x) / (halfWidth - edgeWidth));
              const innerRatioZ = 1 - (Math.abs(z) / (halfDepth - edgeDepth));
              const innerRatio = Math.min(innerRatioX, innerRatioZ); // 取最小占比，确保边缘过渡平滑

              // 计算噪声值并按内部占比缩放（避免在边缘交界处突然隆起）
              const noiseValue = perlinNoise(x * noiseScale, z * noiseScale);
              const elevation = ((noiseValue + 1) / 2) * maxElevation * innerRatio;

              // 应用最终高度
              vertices[i + 1] = landHeight / 2 + elevation;
            }
          }
        }

        // 4. 更新几何体（必须调用）
        landGeometry.attributes.position.needsUpdate = true;
        landGeometry.computeVertexNormals(); // 重新计算法线，确保光照正确

        // 5. 大陆材质（保持不变）
        const landMaterial = new THREE.MeshStandardMaterial({
          color: '#b89b61',
          roughness: 0.8,
          metalness: 0.1,
        });

        // 6. 创建大陆网格并设置位置
        const land = new THREE.Mesh(landGeometry, landMaterial);
        land.position.set(boxWidth / 4, boxHeight / 2 - landHeight / 2, 0);
        box.add(land);
      }





      /* 地壳 */
      {
        /* 地壳（边缘部分顶点隆起） */
        const crustWidth = boxWidth;
        const crustHeight = 0.4; // 基础高度
        const crustDepth = boxDepth;
        const maxElevation = 0.7; // 边缘最大隆起高度（适中，避免过高）
        const noiseScale = 4; // 噪声缩放（控制边缘起伏的密集度）
        const edgeRatio = 0.15; // 边缘隆起区占比（15%宽度/深度为边缘隆起区）

        // 1. 创建地壳几何体（增加分段数，确保边缘起伏细腻）
        const crustGeometry = new THREE.BoxGeometry(crustWidth, crustHeight, crustDepth, 32, 4, 32);
        const vertices = crustGeometry.attributes.position.array; // 获取所有顶点数据

        // 2. 计算边缘范围（局部坐标系下）
        const halfWidth = crustWidth / 2;
        const halfDepth = crustDepth / 2;
        const edgeWidth = halfWidth * edgeRatio; // X方向边缘宽度
        const edgeDepth = halfDepth * edgeRatio; // Z方向边缘深度

        // 3. 遍历顶点，仅边缘区域应用隆起
        for (let i = 0; i < vertices.length; i += 3) {
          const x = vertices[i]; // 顶点X坐标（范围：-halfWidth ~ halfWidth）
          const z = vertices[i + 2]; // 顶点Z坐标（范围：-halfDepth ~ halfDepth）
          const y = vertices[i + 1]; // 顶点Y坐标

          // 只处理地壳顶部的顶点（Y接近基础高度的一半，因BoxGeometry中心在原点）
          if (y > crustHeight / 2 - 0.01) {
            // 判断是否为边缘顶点（X或Z在边缘范围内）
            const isEdgeX = Math.abs(x) > halfWidth - edgeWidth; // X方向边缘
            const isEdgeZ = Math.abs(z) > halfDepth - edgeDepth; // Z方向边缘

            if (isEdgeX || isEdgeZ) {
              // 边缘顶点：应用隆起（用噪声生成不规则高度）
              // 计算距离边缘的“边缘占比”（0~1，越靠近最边缘越接近1）
              const edgeRatioX = isEdgeX ? (Math.abs(x) - (halfWidth - edgeWidth)) / edgeWidth : 0;
              const edgeRatioZ = isEdgeZ ? (Math.abs(z) - (halfDepth - edgeDepth)) / edgeDepth : 0;
              const edgeRatio = Math.max(edgeRatioX, edgeRatioZ); // 取最大占比，确保边缘中心隆起最高

              // 噪声值控制起伏，边缘占比控制隆起强度（越边缘越高）
              const noiseValue = perlinNoise(x * noiseScale, z * noiseScale);
              const elevation = ((noiseValue + 1) / 2) * maxElevation * edgeRatio;

              // 应用隆起高度（顶部顶点Y = 基础高度/2 + 隆起高度）
              vertices[i + 1] = crustHeight / 2 + elevation;
            } else {
              // 内部顶点：保持平坦（不隆起）
              vertices[i + 1] = crustHeight / 2;
            }
          }
        }

        // 4. 更新几何体（必须调用，使顶点修改生效）
        crustGeometry.attributes.position.needsUpdate = true;
        crustGeometry.computeVertexNormals(); // 重新计算法线，确保光照自然

        // 5. 地壳材质（保持原风格）
        const crustMaterial = new THREE.MeshStandardMaterial({
          color: '#946f24',
          roughness: 0.8,
          metalness: 0.1,
        });

        // 6. 创建地壳网格并设置位置
        const crust = new THREE.Mesh(crustGeometry, crustMaterial);
        crust.position.set(0, boxHeight / 2 - oceanAndLandHeight - crustHeight / 2, 0);
        crust.scale.set(1.01, 1.01, 1.01);
        box.add(crust);
      }

      scene.add(group);
    };

    createBox()

    // 9. 窗口resize处理
    const handleResize = () => {
      if (!canvas.current) return;
      const { clientWidth: width, clientHeight: height } = canvas.current;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    // 10. 动画循环
    const render = (time: number) => {
      if (!canvas.current) return;

      // 更新炙热气体的时间参数，驱动动态波动和闪烁
      /*       if (hotGasMaterial.uniforms.time) {
              hotGasMaterial.uniforms.time.value = time * 0.000000001; // 时间缩放，控制波动速度
            } */

      if (oceanRef.current) {
        // @ts-ignore
        oceanRef.current.material.uniforms.time.value += 0.001
      }

      controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);

    // 11. 清理函数
    return () => {
      window.removeEventListener('resize', handleResize);
      labelGroupsRef.current.forEach(group => {
        group.children.forEach(child => {
          if (child instanceof THREE.LineSegments) {
            child.geometry.dispose();
            (child.material as THREE.Material).dispose();
          }
        });
        scene.remove(group);
      });
      renderer.dispose();
      earthMaterial.dispose();
      earthGeometry.dispose();
      earthCoreGeometry.dispose();
      earthCoreMaterial.dispose();
    };
  };

  useEffect(() => {
    if (canvas.current) {
      const clean = main();
      return clean;
    }
  }, [canvas.current]);

  return (
    <div className="canvas-container" style={{ width: '100vw', height: '100vh' }}>
      <canvas
        className="canvas-body"
        ref={canvas}
        style={{ width: '100%', height: '100%' }}
      ></canvas>
    </div>
  );
};

export default EarthConstruct;