import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter, Route, Routes } from 'react-router-dom'
import { Button, ConfigProvider, Space, theme } from 'antd'
import Enhance from './enhance.tsx'

import App from './App.tsx'
import Sphere from './pages/sphere/index.tsx'
import './index.css'
import StaticBox from './pages/static-box/index.tsx'
import CitySpace from './pages/city-space/index.tsx'
import Earth from './pages/earth/index.tsx'
import PointPlane from './pages/point-plane/index.tsx'
import Ground from './pages/ground/index.tsx'
import Sky from './pages/sky/index.tsx'
import Tank from './pages/tank/index.tsx'
import MockTank from './pages/mock-tank/index.tsx'
import SolarSystem from './pages/solar-system/index.tsx'
import CameraFollow from './pages/camera-follow/index.tsx'
import HauntdHouse from './pages/haunted-house/index.tsx'

export const links = [
  {
    name: '旋转的立方体',
    path: '/',
    content: '旋转的立方体',
    element: (
      <Enhance>
        <App key={'/'}></App>
      </Enhance>
    ),
  },
  {
    name: '自转球体光源',
    path: '/sphere',
    content: '自转球体光源',
    element: (
      <Enhance>
        <Sphere key={'/sphere'}></Sphere>
      </Enhance>
    ),
  },
  {
    name: '静止的盒子',
    path: '/static-box',
    content: ` 
    这是一个普通的盒子，加入了定向光源，为了方便调试及确认光源所在位置加入了x轴旋转动画，
    该光源的位置是固定的，只照射了正Z轴（正面），正Y轴（上）
    `
    ,
    element: (
      <Enhance>
        <StaticBox key={'/static-box'}></StaticBox>
      </Enhance>
    ),
  },
  {
    name: '城市空间',
    path: '/city-space',
    content: `城市空间`
    ,
    element: (
      <Enhance>
        <CitySpace key={'/city-space'}></CitySpace>
      </Enhance>
    ),
  },
  {
    name: '地球',
    path: '/earth',
    content: `地球`
    ,
    element: (
      <Enhance>
        <Earth key={'/earth'}></Earth>
      </Enhance>
    ),
  },
  {
    name: '顶点-平面',
    path: '/point-plane',
    content: `顶点-平面`
    ,
    element: (
      <Enhance>
        <PointPlane key={'/point-plane'}></PointPlane>
      </Enhance>
    ),
  },
  {
    name: '地面',
    path: '/ground',
    content: `地面`
    ,
    element: (
      <Enhance>
        <Ground key={'/ground'}></Ground>
      </Enhance>
    ),
  },
  {
    name: '天空',
    path: '/sky',
    content: `天空`
    ,
    element: (
      <Enhance>
        <Sky key={'/sky'}></Sky>
      </Enhance>
    ),
  },
  {
    name: '坦克',
    path: '/tank',
    content: `坦克`
    ,
    element: (
      <Enhance>
        <Tank key={'/tank'}></Tank>
      </Enhance>
    ),
  },
  {
    name: '模拟坦克',
    path: '/mock-tank',
    content: `模拟坦克`
    ,
    element: (
      <Enhance>
        <MockTank key={'/mock-tank'}></MockTank>
      </Enhance>
    ),
  },
  {
    name: '太阳系',
    path: '/solar-system',
    content: `太阳系`
    ,
    element: (
      <Enhance>
        <SolarSystem key={'/solar-system'}></SolarSystem>
      </Enhance>
    ),
  },
  {
    name: '摄像机跟随',
    path: '/camera-follow',
    content: `摄像机跟随`
    ,
    element: (
      <Enhance>
        <CameraFollow key={'/camera-follow'}></CameraFollow>
      </Enhance>
    ),
  },
  {
    name: '鬼屋',
    path: '/haunted-house',
    content: `鬼屋`
    ,
    element: (
      <Enhance>
        <HauntdHouse key={'/haunted-house'}></HauntdHouse>
      </Enhance>
    ),
  },
]

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          // Seed Token，影响范围大
          colorPrimary: '#865bf7',
        },
      }}
    >
      {
        import.meta.env.PROD ? <HashRouter>
          <Routes>
            {links.map(route => (
              <Route key={route.path} path={route.path} element={route.element} />
            ))}
          </Routes>
        </HashRouter> : <BrowserRouter>
          <Routes>
            {links.map(route => (
              <Route key={route.path} path={route.path} element={route.element} />
            ))}
          </Routes>
        </BrowserRouter>
      }

    </ConfigProvider>
  </StrictMode>
)
