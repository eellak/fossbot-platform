import Blockly from 'blockly';

const LightTheme = Blockly.Theme.defineTheme('LightTheme', {
  'base': Blockly.Themes.Classic,
  'blockStyles': {
    'colour_blocks': {
      'colourPrimary': '#a5745b',
      'colourSecondary': '#dbc7bd',
      'colourTertiary': '#845d49'
    },
    'list_blocks': {
      'colourPrimary': '#745ba5',
      'colourSecondary': '#c7bddb',
      'colourTertiary': '#5d4984'
    },
    'logic_blocks': {
      'colourPrimary': '#5b80a5',
      'colourSecondary': '#bdccdb',
      'colourTertiary': '#496684'
    },
    'loop_blocks': {
      'colourPrimary': '#a55b99',
      'colourSecondary': '#a55b99',
      'colourTertiary': '#84497a'
    },
    'math_blocks': {
      'colourPrimary': '#5b67a5',
      'colourSecondary': '#bdc2db',
      'colourTertiary': '#495284'
    },
    'procedure_blocks': {
      'colourPrimary': '#995ba5',
      'colourSecondary': '#d6bddb',
      'colourTertiary': '#7a4984'
    },
    'text_blocks': {
      'colourPrimary': '#5ba55b',
      'colourSecondary': '#bddbbd',
      'colourTertiary': '#498449'
    },
    'variable_blocks': {
      'colourPrimary': '#a55b5b',
      'colourSecondary': '#dbbdbd',
      'colourTertiary': '#844949'
    },
    'variable_dynamic_blocks': {
      'colourPrimary': '#a55b5b',
      'colourSecondary': '#dbbdbd',
      'colourTertiary': '#844949'
    },
    'hat_blocks': {
      'colourPrimary': '#a55b5b',
      'colourSecondary': '#dbbdbd',
      'colourTertiary': '#844949',
      'hat': 'cap'
    }
  },
  'categoryStyles': {
    'colour_category': {
      'colour': '#a5745b'
    },
    'list_category': {
      'colour': '#745ba5'
    },
    'logic_category': {
      'colour': '#5b80a5'
    },
    'loop_category': {
      'colour': '#5ba55b'
    },
    'math_category': {
      'colour': '#5b67a5'
    },
    'procedure_category': {
      'colour': '#995ba5'
    },
    'text_category': {
      'colour': '#a55b99'
    },
    'variable_category': {
      'colour': '#a55b5b'
    },
    'variable_dynamic_category': {
      'colour': '#a55b5b'
    }
  },
  'componentStyles': {
    'workspaceBackgroundColour': '#ffffff',
    'toolboxBackgroundColour': '#f0f0f0',
    'toolboxForegroundColour': '#000000',
    'flyoutBackgroundColour': '#f7f7f7',
    'flyoutForegroundColour': '#000000',
    'flyoutOpacity': 1,
    'scrollbarColour': '#c0c0c0',
    'insertionMarkerColour': '#000000',
    'insertionMarkerOpacity': 0.3,
    'scrollbarOpacity': 0.4,
    'cursorColour': '#000000'
  },
  'fontStyle': {
    'family': 'Helvetica, Arial, sans-serif',
    'weight': 'bold',
    'size': 12
  },
  'startHats': true
});

export default LightTheme;
