from skyfield.api import load
from datetime import date, timedelta
import json

# Load ephemeris and timescale
planets = load('de421.bsp')
ts = load.timescale()

# Define date range
start_date = date(2020, 1, 1)
end_date = date.today()

# Initialize data storage
data = {}

# Iterate over dates
current_date = start_date
while current_date <= end_date:
    # Create time at 00:00:00 UTC
    t = ts.utc(current_date.year, current_date.month, current_date.day)
    
    # Format date as string for data key
    date_str = current_date.strftime('%Y-%m-%d')
    data[date_str] = {}
    
    # Compute positions for planets relative to Sun
    for planet in ['mercury', 'venus', 'earth', 'mars', 'jupiter barycenter', 
                   'saturn barycenter', 'uranus barycenter', 'neptune barycenter']:
        astrometric = planets['sun'].at(t).observe(planets[planet])
        _, lon, _ = astrometric.ecliptic_latlon()
        data[date_str][planet] = lon.degrees
    
    # Compute Moon's position relative to Earth
    astrometric_moon = planets['earth'].at(t).observe(planets['moon'])
    _, lon_m, _ = astrometric_moon.ecliptic_latlon()
    data[date_str]['moon'] = lon_m.degrees
    
    # Next day
    current_date += timedelta(days=1)

# Save to JSON
with open('planetary_positions.json', 'w') as f:
    json.dump(data, f)