import { Object3D } from "../core/Object3D"
import { Mesh } from "../core/Mesh"
import { PlaneGeometry } from "../geometries/PlaneGeometry"
import { MeshBasicMaterial } from "../materials/MeshBasicMaterial"
import { LineSegments } from "../objects/LineSegments"
import { LineBasicMaterial } from "../materials/LineBasicMaterial"
import { BufferGeometry, BufferAttribute } from "../core/BufferGeometry"
import { Line } from "../objects/Line"
import { Color } from "../math/Color"
import { LayoutProps } from "../layout/LayoutTypes"

export interface UIDisplayParameters {
  width: number // Физическая ширина в метрах
  height: number // Физическая высота в метрах
  pixelWidth: number // Разрешение по ширине в пикселях
  pixelHeight: number // Разрешение по высоте в пикселях
  background?: Color | number // Цвет фона экрана
}

/**
 * Физический дисплей для отображения UI.
 * Конвертирует пиксельную верстку (Yoga) в физические размеры мира (Метры).
 */
export class UIDisplay extends Object3D {
  public physicalWidth: number
  public physicalHeight: number
  public pixelWidth: number
  public pixelHeight: number
  public pixelScale: number // Сколько метров в одном пикселе
  public contentContainer: Object3D

  constructor(params: UIDisplayParameters) {
    super()
    this.physicalWidth = params.width
    this.physicalHeight = params.height
    this.pixelWidth = params.pixelWidth
    this.pixelHeight = params.pixelHeight

    // Вычисляем размер одного пикселя в метрах
    // Используем ширину как базу для PPI, или среднее значение
    this.pixelScale = this.physicalWidth / this.pixelWidth

    // 1. Создаем физическую подложку (Корпус/Экран)
    const bgGeometry = new PlaneGeometry({ 
        width: this.physicalWidth, 
        height: this.physicalHeight 
    })
    const bgMaterial = new MeshBasicMaterial({ 
        color: params.background ?? 0x111111 
    })
    const backgroundMesh = new Mesh(bgGeometry, bgMaterial)
    
    // PlaneGeometry создается в XY, для Z-up сцены вертикальный экран должен стоять перпендикулярно Y
    // Но обычно UI рисуется в локальных XY, а сам объект вращается.
    // Оставим геометрию как есть (XY), а контейнер повернем при размещении в сцене.
    this.add(backgroundMesh)

    // 2. Контейнер для контента (Flexbox root)
    this.contentContainer = new Object3D()
    
    // Настройка Yoga Layout для корневого элемента (весь экран)
    this.contentContainer.layout = {
      width: this.pixelWidth,
      height: this.pixelHeight,
      flexDirection: 'column',
      // По умолчанию контент начинается сверху
      justifyContent: 'flex-start',
      alignItems: 'center',
      padding: 20 // Отступ от краев экрана в пикселях
    }

    // Смещаем контент, так как 0,0 в 3D - это центр, а в Layout - левый верхний угол.
    // LayoutManager сам позиционирует детей относительно 0,0 родителя, 
    // но нам нужно сдвинуть весь контейнер так, чтобы его (0,0 layout) совпал с (-w/2, h/2 3d)
    // Однако, наш LayoutManager уже маппит Left/Top в 3D координаты относительно центра родителя.
    // Проверим LayoutManager: он берет left/top ноды. 
    // Для корневого элемента Yoga возвращает 0,0.
    // Чтобы контент рисовался внутри экрана, нам нужно сдвинуть точку отсчета.
    
    // В текущей реализации LayoutManager применяет `position.x = left * scale`.
    // Это значит, что 0,0 Yoga соответствует 0,0 Object3D (центр экрана).
    // Это НЕВЕРНО для UI. В UI 0,0 - это верхний левый угол.
    // 
    // Решение: Сдвигаем contentContainer на половину размера влево и вверх,
    // чтобы (0,0) локальной системы координат был в верхнем левом углу физического экрана.
    this.contentContainer.position.set(
        -this.physicalWidth / 2,
        this.physicalHeight / 2,
        0.005 // Чуть выдвигаем вперед, чтобы текст не проваливался в экран
    )

    this.add(this.contentContainer)

    // 3. Создаем рамку (Border)
    this.createBorder()
  }

  private createBorder(): void {
    const w = this.physicalWidth / 2
    const h = this.physicalHeight / 2
    // Контур прямоугольника
    const vertices = new Float32Array([
        -w, h, 0,   w, h, 0,
        w, h, 0,    w, -h, 0,
        w, -h, 0,   -w, -h, 0,
        -w, -h, 0,  -w, h, 0
    ])
    const borderGeo = new BufferGeometry()
    borderGeo.setAttribute('position', new BufferAttribute(vertices, 3))
    const borderMat = new LineBasicMaterial({ color: 0x555555 })
    const border = new LineSegments(borderGeo, borderMat)
    // Сдвигаем рамку чуть вперед, чтобы была поверх фона
    border.position.z = 0.001
    this.add(border)
  }

  /**
   * Добавляет элемент UI на экран.
   * @param child Объект (Text, Mesh и т.д.)
   */
  public addUI(child: Object3D): void {
    this.contentContainer.add(child)
  }

  /**
   * Возвращает размер шрифта в мировых единицах (метрах) для заданного размера в пикселях.
   */
  public getFontSize(pixels: number): number {
    return pixels * this.pixelScale
  }
}
