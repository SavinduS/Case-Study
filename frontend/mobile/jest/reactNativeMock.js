const React = require('react');

function mockHost(name) {
  function Host(props) {
    const { children, ...rest } = props || {};
    return React.createElement(name, rest, children);
  }
  Host.displayName = name;
  return Host;
}

const View = mockHost('View');
const Text = mockHost('Text');
const ScrollView = mockHost('ScrollView');
const KeyboardAvoidingView = mockHost('KeyboardAvoidingView');
const Pressable = mockHost('Pressable');
const ActivityIndicator = mockHost('ActivityIndicator');
const Image = mockHost('Image');
const TextInput = mockHost('TextInput');

const StyleSheet = {
  create: (styles) => styles,
  flatten: (style) => {
    if (Array.isArray(style)) return Object.assign({}, ...style.filter(Boolean));
    return style;
  },
  hairlineWidth: 1
};

const Platform = {
  OS: 'ios',
  select: (opts) => opts.ios ?? opts.native ?? opts.default
};

module.exports = {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Pressable,
  ActivityIndicator,
  Image,
  TextInput,
  StyleSheet,
  Platform,
  Dimensions: { get: () => ({ width: 375, height: 812 }) },
  Alert: { alert: jest.fn() }
};
