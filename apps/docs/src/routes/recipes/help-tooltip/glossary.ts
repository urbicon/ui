export const glossary = {
  'heizkv-7': {
    term: 'HeizKV § 7',
    text: 'The German Heating Costs Ordinance requires that 50% to 70% of heating costs are billed by consumption. The rest is allocated by living area.'
  },
  jaz: {
    term: 'Jahresarbeitszahl (JAZ)',
    text: 'Seasonal performance factor: heat energy delivered per kWh of electricity, averaged over the whole year. A JAZ of 3.5 turns 1 kWh of electricity into 3.5 kWh of heat.'
  },
  legionella: {
    term: 'Legionella protection',
    text: 'In central hot-water systems the storage temperature must stay at 60 °C or above to prevent legionella growth (Drinking Water Ordinance, TrinkwV § 14).'
  },
  wmz: {
    term: 'Wärmemengenzähler (WMZ)',
    text: 'Heat meter: measures the heat energy delivered, in kWh. Mandatory in multi-unit buildings, so heating and hot water can be billed to each apartment by actual use.'
  }
} as const;

export type GlossaryKey = keyof typeof glossary;
