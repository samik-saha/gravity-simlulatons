# 🌌 N-Body Gravitational Dynamics Visualizer

A high-performance, real-time simulator for N-body gravitational interactions ($N \leq 3$). This tool allows you to explore the chaotic nature of orbital mechanics through a sleek, interactive dashboard.

![Gravity Visualizer Workflow](https://img.shields.io/badge/Physics-Calculated-blue?style=for-the-badge)
![React & Canvas](https://img.shields.io/badge/Built%20With-React%20%2B%20Canvas-61DAFB?style=for-the-badge)

## ✨ Core Features

- **Complex Systems Library**: Instantly load astronomical scenarios including:
  - **Binary Star Systems** (stable barycentric orbits)
  - **Planetary Orbits** (circular and elliptical)
  - **Circumbinary Planets** (Tatooine-like 3rd body dynamics)
  - **Synthetic Solar Systems** ($2$ planets + $1$ star)
- **High-Density Control Deck**:
  - **Manual Initial Conditions**: Modify masses ($M_{\odot}$), X, and Y positions when paused.
  - **Live Instrumentation**: Real-time distance tracking between all pairs in **Astronomical Units (AU)**.
  - **Time & Speed**: Adjustable time-step resolution and simulation sub-frame steps for high-precision integration.
- **Visual Performance**:
  - **Ultra-Long Path Trails**: Track up to **10,000 points** per body with optimized single-path rendering.
  - **Dynamic Glow & HSL Colors**: Bodies emit light based on their proximity and mass.
  - **Smooth Zoom & Pan**: Fluid navigation through the gravitational field using mouse or touch.

## 🛠️ How to Use

### 🕹️ Interaction
- **Add Body**: Click (short tap) on any empty area (Max 3 bodies).
- **Remove Body**: Click directly on a moving body to remove it.
- **Drag View**: Move your mouse or finger anywhere to pan the camera.
- **Pause & Resume**: Use the main control block to toggle the flow of time.

### 📐 Manual Entry
1. **Pause** the simulation using the **Pause** button.
2. The **Dynamics Control** section will switch to **Manual Mode**.
3. Type in desired numeric values for **Mass**, **X**, or **Y** positions.
4. Manually updating a position will reset that body's flight path trail for clarity.

## 🔬 Physics & Technical Details

- **Integration**: The engine uses a **Semi-Implicit Euler** method. While the 3-body problem is famously non-integrable (no general analytical closed-form solution exists), this numerical approach provides a stable and visually accurate representation of chaotic trajectories.
- **Chaos Theory**: Observe the "Butterfly Effect"—even a $0.1\%$ change in mass or initial position can lead to radically different long-term orbital outcomes over a few thousand frames.
- **Optimization**: To handle 30,000+ coordinates for trails without lag, the rendering logic bypasses the sub-frame physics loop, performing path updates only once per redraw.

## 🚀 Getting Started

1.  **Install dependencies**:
    ```bash
    npm install
    ```
2.  **Run the local dev server**:
    ```bash
    npm run dev
    ```

---
*Developed for advanced gravitational exploration.*
