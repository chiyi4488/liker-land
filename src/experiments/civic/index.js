export default {
  name: 'civic-page',
  experimentID: 'wQOwprfHQm-1SVopG4BQUQ',
  isEligible: ({ route }) => !process.server && route.name === 'civic',
  variants: [{ name: 'origin', weight: 5 }, { name: 'variant', weight: 5 }],
};
