# Hardware Reference Assets

This folder stores wiring and PCB assets used by this integrated project.

## Clean Pinout Diagram

- `docs/hardware/ti84-esp32-pinout.svg`

This diagram maps TI-84 link jack pins to firmware pin usage in this repo:
- `TIP -> D1`
- `RING -> D10`
- `SLEEVE -> GND`

## Imported PCB Design (from TI-84-GPT-HACK)

Source folder used in this workspace:
- `../TI-84-GPT-HACK/pcb/`

Imported files:
- `docs/hardware/ti84-gpt-hack-pcb/schematic.png`
- `docs/hardware/ti84-gpt-hack-pcb/built.png`
- `docs/hardware/ti84-gpt-hack-pcb/outline.svg`
- `docs/hardware/ti84-gpt-hack-pcb/cheating-calc.kicad_pcb`
- `docs/hardware/ti84-gpt-hack-pcb/cheating-calc.kicad_sch`

Use these files as a reference design for:
- TI-84 link jack routing (TIP/RING/SLEEVE)
- ESP32 physical placement and board outline
- KiCad-based PCB customization for your own enclosure

## BOM Note

The imported KiCad schematic labels resistors as `R1..R4` with value `R` (placeholder).
Define actual resistor values before manufacturing a PCB.
