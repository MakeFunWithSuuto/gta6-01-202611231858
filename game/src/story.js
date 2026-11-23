// "Sunburn", the story of Port Solera: who is who, and the five missions as data.
// Each mission is a list of steps the mission runner in missions.js plays in order.
import { BLOCK, ROAD, SIDEWALK, KERB } from './config.js';
import { blockRect } from './city.js';

export const CAST = {
  teo: { name: 'Teo Marlow', color: '#ff7a59' },
  nena: { name: 'Nena Duarte', color: '#f5a623' },
  marco: { name: 'Marco Bellavista', color: '#c77dff' },
  gull: { name: 'Grey Gull', color: '#ff5a4f' },
  radio: { name: 'Police scanner', color: '#5aa0ff' },
};

const pave = (bx, by, fx, fy) => {
  const r = blockRect(bx, by);
  return { x: r.x + r.w * fx, y: r.y + r.h * fy };
};
const kerb = (roadX, y) => ({ x: roadX * BLOCK + KERB, y });

/** Build the mission list for a city (positions depend on its places). */
export function buildStory(city) {
  const chop = city.places.chopshop, safe = city.places.safehouse, respray = city.places.respray;
  const marco = { x: blockRect(4, 4).x + SIDEWALK / 2, y: blockRect(4, 4).y + 200 };
  const yard = pave(1, 7, 0.5, 0.78);
  const hotel = { x: blockRect(8, 2).x + blockRect(8, 2).w - SIDEWALK / 2, y: blockRect(8, 2).y + 120 };
  return [
    {
      id: 'homecoming', title: 'Homecoming', giver: 'nena', start: { x: chop.x, y: chop.y - 2 }, reward: 500,
      steps: [
        { type: 'talk', lines: [['nena', 'Teo Marlow. Five years and you walk back in like it is Tuesday.'], ['teo', 'I need work, Nena. Anything.'], ['nena', 'A Kestrel GT is parked on Avenida Seis, by Solera Centro. Bring it here without a scratch.']] },
        { type: 'steal', model: 'kestrel', at: { ...kerb(6, 4.45 * BLOCK), angle: -Math.PI / 2 }, text: 'Steal the ~Kestrel GT~ parked by Solera Centro' },
        { type: 'goto', x: chop.x, y: chop.y - 20, r: 60, needMissionCar: true, text: 'Deliver the Kestrel to ~Wrench & Rust~' },
        { type: 'talk', lines: [['nena', 'Clean work. You still drive like your father.'], ['nena', 'Here is your cut. Come back when you want more.']] },
      ],
    },
    {
      id: 'hotwheels', title: 'Hot Wheels', giver: 'nena', start: { x: chop.x + 40, y: chop.y - 2 }, reward: 800, unlock: 'pistol',
      steps: [
        { type: 'talk', lines: [['nena', 'That Saguaro outside was in a bank job last night. Every cop in Solera knows the plate.'], ['nena', 'Take it to Sunshine Respray. Lose the heat on the way. And take this, just in case.']] },
        { type: 'give', weapon: 'pistol', ammo: 48 },
        { type: 'steal', model: 'saguaro', at: { x: chop.x - 70, y: chop.y - 13, angle: 0 }, text: 'Get in the ~hot Saguaro~' },
        { type: 'wanted', level: 2 },
        { type: 'lose', text: 'Lose the ~police~', needMissionCar: true },
        { type: 'goto', x: respray.x - SIDEWALK - 30, y: respray.y, r: 60, needMissionCar: true, text: 'Drive to ~Sunshine Respray~' },
        { type: 'talk', lines: [['nena', 'New paint, new plates. The Saguaro never existed. Nice.'], ['nena', 'A man called Marco Bellavista wants to meet you. Centro. Do not trust his smile.']] },
      ],
    },
    {
      id: 'gullseason', title: 'Gull Season', giver: 'marco', start: marco, reward: 1200, unlock: 'smg',
      steps: [
        { type: 'talk', lines: [['marco', 'The famous Teo. Sit. The Grey Gulls stole my ledger and hid in the Ironwharf yard.'], ['marco', 'Four of them. Bring back the ledger. How is your business, not mine.']] },
        { type: 'goto', x: yard.x, y: yard.y - 120, r: 140, text: 'Go to the ~Ironwharf container yard~' },
        { type: 'kill', at: [[yard.x - 120, yard.y - 30], [yard.x + 110, yard.y - 40], [yard.x, yard.y + 40], [yard.x - 160, yard.y + 50], [yard.x + 160, yard.y + 50]], text: 'Take out the ~Grey Gulls~' },
        { type: 'pickup', x: yard.x + 20, y: yard.y + 10, item: 'ledger', text: 'Grab the ~ledger~' },
        { type: 'wanted', level: 1 },
        { type: 'goto', x: marco.x, y: marco.y, r: 40, text: 'Return the ledger to ~Marco~' },
        { type: 'talk', lines: [['marco', 'Every page intact. You are wasted on stolen cars, Teo.'], ['marco', 'A gift from my friends at Sunline Arms. You will need it.']] },
      ],
    },
    {
      id: 'express', title: 'Express Delivery', giver: 'marco', start: { x: marco.x, y: marco.y + 50 }, reward: 1000,
      steps: [
        { type: 'talk', lines: [['marco', 'A courier left a case in a Vista Alta garden. It must reach the Hotel Mareva in ninety seconds.'], ['marco', 'After that the buyer leaves, and so do my good feelings.']] },
        { type: 'pickup', x: pave(1, 0, 0.5, 0.95).x, y: pave(1, 0, 0.5, 0.95).y - 6, item: 'case', text: 'Collect the ~case~ in Vista Alta' },
        { type: 'goto', x: hotel.x, y: hotel.y, r: 60, time: 90, text: 'Deliver the case to ~Hotel Mareva~' },
        { type: 'talk', lines: [['marco', 'With seconds to spare. The buyer liked you.'], ['marco', 'Now. Something bigger. The hotel vault, the night of the Coral Gala.']] },
      ],
    },
    {
      id: 'coraljob', title: 'The Coral Job', giver: 'nena', start: { x: chop.x - 40, y: chop.y - 2 }, reward: 5000, unlock: 'shotgun',
      steps: [
        { type: 'talk', lines: [['nena', 'Marco told me. The gala vault. You and me, like old times.'], ['nena', 'Take the Mako van. Park at the hotel loading bay and hold it while I crack the vault.']] },
        { type: 'steal', model: 'mako', at: { x: chop.x + 80, y: chop.y - 13, angle: 0 }, text: 'Get in the ~Mako van~' },
        { type: 'goto', x: hotel.x + 30, y: hotel.y + 40, r: 70, needMissionCar: true, text: 'Drive to the ~Hotel Mareva~ loading bay' },
        { type: 'hold', x: hotel.x + 30, y: hotel.y + 40, r: 120, seconds: 12, text: 'Hold the loading bay while Nena cracks the vault', spawnGulls: true },
        { type: 'wanted', level: 4 },
        { type: 'talk', lines: [['radio', 'All units, robbery at Hotel Mareva. Suspects in a white Mako van.'], ['nena', 'Drive, Teo. DRIVE!']] },
        { type: 'lose', text: 'Escape the ~police~ with the van', needMissionCar: true },
        { type: 'goto', x: safe.x, y: safe.y + ROAD / 2 + 10, r: 70, needMissionCar: true, text: 'Bring the van to the ~safehouse~' },
        { type: 'talk', lines: [['nena', 'Five thousand each, and Marco thinks the vault was empty.'], ['teo', 'Welcome home, Teo. Port Solera is ours now.']] },
      ],
    },
  ];
}
