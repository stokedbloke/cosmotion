/************************************************************
 * 1) All Emotions & Colors
 ************************************************************/
const allEmotions = [
    'neutral', 'approval', 'realization', 'annoyance', 'disapproval', 'disappointment',
    'optimism', 'admiration', 'confusion', 'disgust', 'anger', 'sadness', 'amusement',
    'excitement', 'caring', 'curiosity', 'fear', 'desire', 'joy', 'love', 'gratitude',
    'surprise', 'embarrassment', 'relief', 'grief', 'nervousness', 'remorse', 'pride'
];

// Generate a consistent color for each emotion
const emotionColors = d3.quantize(d3.interpolateRainbow, allEmotions.length);
const color = d3.scaleOrdinal().domain(allEmotions).range(emotionColors);

/************************************************************
 * 2) Orbital Parameters (Approximate)
 ************************************************************/
/*
  We include the Moon here with a ~27.3 day period.
  This is a hacky approach: we treat the Moon like a planet,
  then offset its angle by Earth's angle to get a relative orbit.
*/
const planetData = {
  mercury: { period: 87.97,  epochAngle: 174.8 },
  venus:   { period: 224.7,  epochAngle: 50.4  },
  earth:   { period: 365.25, epochAngle: 357.5 },
  mars:    { period: 686.98, epochAngle: 19.4  },
  jupiter: { period: 4332.59,epochAngle: 20.0  },
  saturn:  { period: 10759,  epochAngle: 317.0 },
  uranus:  { period: 30687,  epochAngle: 142.0 },
  neptune: { period: 60190,  epochAngle: 256.0 },
  moon:    { period: 27.3217, epochAngle: 0.0  } // approximate
};

// Planet color scheme + ring for Saturn (optional)
const planetStyles = {
  mercury: { fill: '#aaa'      },
  venus:   { fill: '#e0c181'   },
  earth:   { fill: 'blue'      },
  mars:    { fill: 'red'       },
  jupiter: { fill: 'orange'    },
  saturn:  { fill: 'khaki'     },
  uranus:  { fill: 'lightblue' },
  neptune: { fill: 'purple'    },
  moon:    { fill: 'lightgray' }
};

/************************************************************
 * 3) Real-Time Angle Calculation
 ************************************************************/
function computeAngle(planet, dateObj) {
  const pData = planetData[planet];
  const epoch = new Date('2000-01-01T12:00:00Z'); // J2000 epoch
  const diffDays = (dateObj - epoch) / (1000 * 60 * 60 * 24);
  // Mean anomaly (degrees) = epochAngle + (360/period)*diffDays, mod 360
  const angle = (pData.epochAngle + (360 / pData.period) * diffDays) % 360;
  return angle < 0 ? angle + 360 : angle;
}

/************************************************************
 * 4) Fetch Emotions + HRV Data
 ************************************************************/
Promise.all([
  fetch('data/aggregated_journal_entries.json').then(res => res.json()),
  fetch('data/oura_data.json').then(res => res.json())
])
.then(([emotionsData, sleepData]) => {
  // Process emotions into a date-based lookup
  const emotionsByDate = {};
  emotionsData.forEach(entry => {
    const date = entry.date_created || entry.date;
    const eObj = {};
    allEmotions.forEach(em => {
      eObj[em] = entry[`emotion_${em}`] || 0;
    });
    emotionsByDate[date] = eObj;
  });

  // Process HRV into a date-based lookup
  const hrvByDate = {};
  sleepData.forEach(entry => {
    hrvByDate[entry.day] = entry.average_hrv;
  });

  // ************************************************************
  // CHANGED: We always go up to today's date (client side).
  // ************************************************************
  const startDate = new Date('2020-01-01');
  const endDate = new Date(); // always "today" on client side

  // Build date array from startDate to endDate
  const dates = [];
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }

  // Basic slider + controls
  const slider = document.getElementById('date-range');
  slider.min = 0;
  slider.max = dates.length - 1;
  slider.value = 0;
  const currentDateEl = document.getElementById('current-date');

  function updateDate(index) {
    const dateStr = dates[index];
    currentDateEl.textContent = dateStr;
    updateVisualizations(dateStr);
  }

  slider.addEventListener('input', (e) => {
    updateDate(parseInt(e.target.value, 10));
  });

  let playing = false;
  let intervalId = null;
  const playButton = document.getElementById('play-button');
  playButton.addEventListener('click', () => {
    if (playing) {
      clearInterval(intervalId);
      intervalId = null;
      playButton.textContent = 'Play';
      playing = false;
    } else {
      let index = parseInt(slider.value, 10);
      intervalId = setInterval(() => {
        index = (index + 1) % dates.length;
        slider.value = index;
        updateDate(index);
      }, 1000);
      playButton.textContent = 'Pause';
      playing = true;
    }
  });

  /************************************************************
   * 5) D3 Setup: Solar System
   ************************************************************/
  const svgSolar = d3.select('#solar-system')
    .append('svg')
    .attr('width', 500)
    .attr('height', 500)
    .style('background', 'black');

  // Sun
  svgSolar.append('circle')
    .attr('cx', 250)
    .attr('cy', 250)
    .attr('r', 10)
    .attr('fill', 'yellow');

  // Planet distances (in pixels)
  const planetRadii = {
    mercury: 50, venus: 70, earth: 90, mars: 110,
    jupiter: 150, saturn: 190, uranus: 230, neptune: 270
  };

  // Create planet circles (excluding the Moon, which is special)
  const planets = {};
  for (let p of Object.keys(planetRadii)) {
    planets[p] = svgSolar.append('circle')
      .attr('r', p === 'jupiter' ? 8 : p === 'saturn' ? 7 : 5)
      .attr('fill', planetStyles[p].fill);
  }

  // Optional ring for Saturn
  const saturnRing = svgSolar.append('ellipse')
    .attr('fill', 'none')
    .attr('stroke', 'khaki')
    .attr('stroke-width', 2);

  // Moon circle
  const moon = svgSolar.append('circle')
    .attr('r', 2)
    .attr('fill', planetStyles.moon.fill);

  /************************************************************
   * 6) D3 Setup: Emotion Wheel
   ************************************************************/
  const svgWheel = d3.select('#emotion-wheel')
    .append('svg')
    .attr('width', 500)
    .attr('height', 500)
    .style('background', 'black');

  svgWheel.append('circle')
    .attr('cx', 250)
    .attr('cy', 250)
    .attr('r', 200)
    .attr('fill', 'none')
    .attr('stroke', '#444')
    .attr('stroke-width', 1);

  // 28 equal slices
  const pie = d3.pie().value(() => 1).sort(null);
  const arc = d3.arc().innerRadius(100).outerRadius(200);
  const emotionGroup = svgWheel.append('g')
    .attr('transform', 'translate(250, 250)');

  // HRV text
  const hrvText = svgWheel.append('text')
    .attr('class', 'hrv-text')
    .attr('x', 250)
    .attr('y', 250)
    .attr('text-anchor', 'middle')
    .attr('font-size', '20px')
    .attr('fill', 'white');

  /************************************************************
   * 7) updateVisualizations(date)
   ************************************************************/
  function updateVisualizations(date) {
    const dateObj = new Date(date);

    // ---------- Solar System ----------
    // Planets (except Moon)
    for (let p of Object.keys(planetRadii)) {
      const angleDeg = computeAngle(p, dateObj);
      const thetaRad = angleDeg * Math.PI / 180;
      const r = planetRadii[p];

      // Place planet
      const x = 250 + r * Math.cos(thetaRad);
      const y = 250 - r * Math.sin(thetaRad);
      planets[p].attr('cx', x).attr('cy', y);

      // If Saturn, update ring
      if (p === 'saturn') {
        saturnRing
          .attr('rx', 12)
          .attr('ry', 5)
          .attr('transform', `translate(${x},${y}) rotate(${-(angleDeg)})`);
      }
    }

    // Earth for reference
    const earthAngleDeg = computeAngle('earth', dateObj);
    const earthThetaRad = earthAngleDeg * Math.PI / 180;
    const rEarth = planetRadii['earth'];
    const xEarth = 250 + rEarth * Math.cos(earthThetaRad);
    const yEarth = 250 - rEarth * Math.sin(earthThetaRad);

    // Moon: relative orbit around Earth
    const moonAngleDeg = computeAngle('moon', dateObj);
    const moonTotalDeg = earthAngleDeg + moonAngleDeg; // hack: offset
    const moonTotalRad = moonTotalDeg * Math.PI / 180;
    const dMoon = 5; // distance from Earth in pixels

    moon
      .attr('cx', xEarth + dMoon * Math.cos(moonTotalRad))
      .attr('cy', yEarth - dMoon * Math.sin(moonTotalRad));

    // ---------- Emotions ----------
    const eObj = emotionsByDate[date] || {};
    const emotionData = allEmotions.map(em => ({
      name: em,
      percentage: eObj[em] || 0
    }));

    const hasData = emotionData.some(d => d.percentage > 0);
    const top5 = hasData
      ? emotionData.slice().sort((a,b) => b.percentage - a.percentage).slice(0,5).map(d => d.name)
      : [];

    // arcs
    const arcs = emotionGroup.selectAll('.arc')
      .data(pie(emotionData), d => d.data.name);

    // ENTER
    const arcEnter = arcs.enter()
      .append('g')
      .attr('class', 'arc');

    arcEnter.append('path')
      .attr('d', arc)
      .attr('fill', d => color(d.data.name))
      .attr('stroke', d => top5.includes(d.data.name) && hasData ? 'white' : 'none')
      .attr('stroke-width', 2)
      .append('title')
      .text(d => d.data.percentage > 0 ? `${d.data.name}: ${(d.data.percentage * 100).toFixed(1)}%` : '');

    arcEnter.append('text')
      .each(function(d) {
        if (top5.includes(d.data.name) && d.data.percentage > 0) {
          d3.select(this)
            .attr('text-anchor', 'middle')
            .attr('font-size', '12px')
            .attr('fill', 'white')
            .attr('transform', () => {
              const [xx, yy] = arc.centroid(d);
              const angle = ((d.startAngle + d.endAngle) / 2) * (180 / Math.PI) - 90;
              return `translate(${xx}, ${yy}) rotate(${angle})`;
            })
            .text(d.data.name);
        }
      });

    // UPDATE
    arcs.select('path')
      .attr('d', arc)
      .attr('fill', d => color(d.data.name))
      .attr('stroke', d => top5.includes(d.data.name) && hasData ? 'white' : 'none')
      .attr('stroke-width', 2);
    arcs.select('title')
      .text(d => d.data.percentage > 0 ? `${d.data.name}: ${(d.data.percentage * 100).toFixed(1)}%` : '');

    arcs.selectAll('text').remove();
    arcs.each(function(d) {
      if (top5.includes(d.data.name) && d.data.percentage > 0) {
        d3.select(this)
          .append('text')
          .attr('text-anchor', 'middle')
          .attr('font-size', '12px')
          .attr('fill', 'white')
          .attr('transform', () => {
            const [xx, yy] = arc.centroid(d);
            const angle = ((d.startAngle + d.endAngle) / 2) * (180 / Math.PI) - 90;
            return `translate(${xx}, ${yy}) rotate(${angle})`;
          })
          .text(d.data.name);
      }
    });

    // EXIT
    arcs.exit().remove();

    // HRV
    const hrvVal = hrvByDate[date];
    hrvText.text(hrvVal ? `HRV: ${hrvVal}` : 'HRV: N/A');
    hrvText.raise();
  }

  // Initialize with the first date
  updateDate(0);
})
.catch(err => {
  console.error('Error fetching data or initializing:', err);
});
