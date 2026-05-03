import "./style.css";
import rough from "roughjs";

const svg = document.querySelector("svg");
const rc = rough.svg(svg);
const polygon = rc.polygon(
  [
    [10, 10],
    [200, 10],
    [100, 100],
    [100, 50],
    [300, 100],
    [60, 200],
  ],
  {
    fill: "red",
    hachureAngle: -45, // angle of hachure,
    hachureGap: 2,
    strokeWidth: 2,
    // fillStyle: "solid",
    // stroke: "black",
    // strokeWidth: 2,
    // fill: "red",
    // hachureAngle: 90,
  },
);
console.log(polygon);

svg.appendChild(polygon);
