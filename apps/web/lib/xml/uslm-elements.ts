// USLM's element vocabulary, and how GovInfo's Bill DTD maps onto it. The
// vocabulary is the yardstick a front end's output is measured against: an
// element whose name is here is known; anything else counts against the
// document's coverage and shows up in the Compiler page's fall-outs, which
// is how this list grows. Source: the USLM schema at github.com/usgpo/uslm
// (uslm-2.1.0.xsd) and the Bill DTD GovInfo's BILLS collection uses.

export const USLM_LEVELS = [
  "title", "subtitle", "chapter", "subchapter", "part", "subpart", "division", "subdivision", "article", "subarticle",
  "section", "subsection", "paragraph", "subparagraph", "clause", "subclause", "item", "subitem", "subsubitem",
  "level", "appendix", "compiledAct", "courtRules", "courtRule", "preliminary", "book", "rule", "subrule",
] as const

const STRUCTURE = [
  "lawDoc", "bill", "resolution", "amendment", "uscDoc", "statutesAtLarge", "pLaw", "meta", "preface", "main", "signatures", "appendix",
  "docNumber", "docTitle", "docType", "docStage", "docPublicationName", "docReleasePoint", "longTitle", "shortTitle", "officialTitle",
  "enactingFormula", "resolvingClause", "recital", "recitals", "preamble", "action", "actionDescription", "date", "currentChamber", "congress", "session",
  "sponsor", "cosponsor", "committee", "property", "relatedDocument", "relatedDocuments", "identifier", "publisher", "creator", "created", "type", "title",
  "dc:title", "dc:type", "dc:publisher", "dc:creator", "dc:identifier", "dc:date", "dc:format", "dc:language", "dc:rights", "dc:description", "dcterms:created", "dcterms:issued",
  "processedBy", "processedDate", "citableAs", "publicPrivate", "enrolledDateline", "associatedDoc", "colspec", "tgroup", "amendmentInstruction", "amendmentContent", "instruction", "toc", "tocItem", "referenceItem", "layout", "header", "column", "row",
  "notes", "note", "sourceCredit", "statutoryNote", "editorialNote", "changeNote", "authorityNote", "footnote", "endnote",
]

const CONTENT = [
  "num", "heading", "subheading", "content", "chapeau", "continuation", "proviso", "quotedContent", "quotedText", "p", "text", "block",
  "table", "caption", "colgroup", "col", "thead", "tbody", "tfoot", "tr", "td", "th",
  "ref", "term", "def", "inline", "b", "i", "u", "sup", "sub", "br", "img", "span", "div", "signature", "role", "name", "made", "hr", "date", "marker", "ins", "del",
  "role", "proviso", "sidenote", "affected", "page", "line", "quotedStructure",
]

export const USLM_ELEMENTS: ReadonlySet<string> = new Set([...USLM_LEVELS, ...STRUCTURE, ...CONTENT])

/** Whether an element name is in the vocabulary; an XML namespace prefix the schema declares counts. */
export const isUslm = (tag: string) => USLM_ELEMENTS.has(tag) || tag.startsWith("dc:") || tag.startsWith("dcterms:") || tag.startsWith("xhtml:")

/** The levels a document's hierarchy is made of, in both dialects. */
export const LEVEL_NAMES: ReadonlySet<string> = new Set([...USLM_LEVELS, "appropriations-major", "appropriations-intermediate", "appropriations-small"])

/**
 * GovInfo's Bill DTD, element by element, to the USLM name. `text` is the
 * one that depends on where it sits: the first text of a level that has
 * child levels is its chapeau; anywhere else it is content (frontends/us.ts).
 */
export const DTD_TO_USLM: Readonly<Record<string, string>> = {
  "enum": "num",
  "header": "heading",
  "text": "content",
  "continuation-text": "continuation",
  "after-quoted-block": "continuation",
  "quoted-block": "quotedContent",
  "external-xref": "ref",
  "internal-xref": "ref",
  "footnote-ref": "ref",
  "footnote": "footnote",
  "quote": "quotedText",
  "italic": "i",
  "bold": "b",
  "subscript": "sub",
  "superscript": "sup",
  "linebreak": "br",
  "pagebreak": "br",
  "legis-body": "main",
  "resolution-body": "main",
  "engrossed-amendment-body": "main",
  "amendment-body": "main",
  "form": "preface",
  "official-title": "longTitle",
  "short-title": "shortTitle",
  "legis-num": "docNumber",
  "legis-type": "docType",
  "distribution-code": "property",
  "current-chamber": "currentChamber",
  "action-date": "date",
  "action-desc": "actionDescription",
  "committee-name": "committee",
  "toc-entry": "tocItem",
  "toc-quoted-entry": "tocItem",
  "multi-column-toc-entry": "tocItem",
  "attestation": "signatures",
  "attestor": "signature",
  "attestation-date": "date",
  "amendment-doc": "amendment",
  "amendment-block": "amendment",
  "amendment-instruction": "amendmentInstruction",
  "enacting-clause": "enactingFormula",
  "resolving-clause": "resolvingClause",
  "whereas": "recital",
  "preamble": "preamble",
  "appropriations-major": "level",
  "appropriations-intermediate": "level",
  "appropriations-small": "level",
  "tgroup": "tbody",
  "entry": "td",
  "row": "tr",
  "endorsement": "note",
  "attestation-group": "signatures",
  "official-title-amendment": "longTitle",
  "amendment-instructions": "amendmentInstruction",
  "quoted-block-continuation-text": "continuation",
  "metadata": "meta",
  "dublinCore": "property",
  "added-phrase": "ins",
  "deleted-phrase": "del",
  "constitution-article": "level",
  "header-in-text": "heading",
  "fraction": "inline",
  "calendar": "property",
  "action-instruction": "actionDescription",
  "associated-doc": "associatedDoc",
}
