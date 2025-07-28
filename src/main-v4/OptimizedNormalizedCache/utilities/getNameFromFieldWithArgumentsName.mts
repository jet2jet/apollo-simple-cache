const regex = /^(.*):v$/;

// @internal
export default function getNameFromFieldWithArgumentsName(
  fieldName: string
): string | undefined {
  const ra = regex.exec(fieldName);
  return ra ? ra[1]! : undefined;
}
