from defusedxml import ElementTree
from defusedxml.common import DefusedXmlException


def blockly_xml_error(content: str) -> str | None:
    try:
        root = ElementTree.fromstring(content, forbid_dtd=True)
    except (ElementTree.ParseError, DefusedXmlException):
        return "Blockly workspace XML is invalid"
    if root.tag.rsplit("}", 1)[-1] != "xml":
        return "The Blockly workspace must have an xml root"
    return None
