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
const RefreshControl = mockHost('RefreshControl');

function FlatList(props) {
  const { data, renderItem, ListHeaderComponent, ListEmptyComponent, ...rest } = props || {};
  const header = ListHeaderComponent
    ? (React.isValidElement(ListHeaderComponent) ? ListHeaderComponent : React.createElement(React.Fragment, null))
    : null;
  const items = Array.isArray(data) && data.length > 0 && renderItem
    ? data.map((item, index) => React.createElement(React.Fragment, { key: index }, renderItem({ item, index })))
    : null;
  const empty = (!Array.isArray(data) || data.length === 0) && ListEmptyComponent
    ? (React.isValidElement(ListEmptyComponent) ? ListEmptyComponent : null)
    : null;
  return React.createElement('View', rest, header, items, empty);
}
FlatList.displayName = 'FlatList';

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
  FlatList,
  RefreshControl,
  StyleSheet,
  Platform,
  Dimensions: { get: () => ({ width: 375, height: 812 }) },
  Alert: { alert: jest.fn() }
};
