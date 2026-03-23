/**
 * Tutorial image assets.
 * The physical PNG files are placed in this directory by the developer.
 * Metro will resolve them at build time once the files are added.
 */
export const TUTORIAL_IMAGES = {
  s1: require('./s1.png'),
  s2: require('./s2.png'),
  s3: require('./s3.png'),
  s4: require('./s4.png'),
  s5: {
    ember:  require('./s5_red.png'),
    tide:   require('./s5_blue.png'),
    bloom:  require('./s5_yellow.png'),
    gale:   require('./s5_green.png'),
    hearth: require('./s5_purple.png'),
  },
  s6: require('./s6.png'),
  s7: require('./s7.png'),
  s8: require('./s8.png'),
} as const;
