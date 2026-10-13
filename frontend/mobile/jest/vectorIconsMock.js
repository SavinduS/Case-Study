const React = require('react');

function makeIcon(name) {
  function Icon(props) {
    return React.createElement('Text', { ...props, accessibilityLabel: props.accessibilityLabel || name }, name);
  }
  Icon.displayName = name;
  return Icon;
}

module.exports = {
  Ionicons: makeIcon('Ionicons'),
  MaterialCommunityIcons: makeIcon('MaterialCommunityIcons'),
  __esModule: true,
  default: { Ionicons: makeIcon('Ionicons') }
};
