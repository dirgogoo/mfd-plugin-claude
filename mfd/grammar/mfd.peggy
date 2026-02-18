// =============================================================================
// MFD-DSL PEG Grammar (Peggy)
// Covers all 18 constructs: system, component, element, entity, enum, flow, state,
// event, signal, api, rule, dep, secret, screen, journey, operation, @decorators, # comments
// =============================================================================

{
  // Per-parse initializer — location() is available in rule actions
  function loc() {
    return location();
  }
}

// ---------------------------------------------------------------------------
// Top-level: Document
// ---------------------------------------------------------------------------

Document
  = __ items:TopLevelItem* __ {
    return { type: "MfdDocument", loc: loc(), body: items.filter(Boolean) };
  }

TopLevelItem
  = SystemDecl
  / ComponentDecl
  / ElementDecl
  / EntityDecl
  / EnumDecl
  / FlowDecl
  / StateDecl
  / EventDecl
  / SignalDecl
  / ApiDecl
  / RuleDecl
  / DepDecl
  / SecretDecl
  / ScreenDecl
  / JourneyDecl
  / OperationDecl
  / ActionDecl
  / IncludeDecl
  / SemanticComment
  / TopLevelError

TopLevelError
  = raw:$(!TopLevelKeyword !"}" [^\n\r]+ [\n\r]?) __ {
    return { type: "ErrorNode", loc: loc(), raw: raw.trim(), context: "top-level" };
  }

TopLevelKeyword
  = ("system" / "component" / "element" / "entity" / "enum" / "flow" / "state"
    / "event" / "signal" / "api" / "rule" / "dep" / "secret" / "screen"
    / "journey" / "operation" / "action" / "import" / "include" / "#") !IdentContinue

// ---------------------------------------------------------------------------
// system
// ---------------------------------------------------------------------------

SystemDecl
  = "system" __ name:StringLiteral __ decos:Decorators __ "{" __ body:SystemBody __ "}" __ {
    return { type: "SystemDecl", loc: loc(), name, decorators: decos, body };
  }

SystemBody
  = items:(SystemBodyItem __)* {
    return items.map(i => i[0]).filter(Boolean);
  }

SystemBodyItem
  = IncludeDecl
  / ComponentDecl
  / SemanticComment
  / SystemBodyError

SystemBodyError
  = raw:$(!SystemBodyKeyword !"}" [^\n\r]+ [\n\r]?) __ {
    return { type: "ErrorNode", loc: loc(), raw: raw.trim(), context: "system-body" };
  }

SystemBodyKeyword
  = ("import" / "include" / "component" / "#") !IdentContinue

// ---------------------------------------------------------------------------
// include
// ---------------------------------------------------------------------------

IncludeDecl
  = ("import" / "include") __ path:StringLiteral __ {
    return { type: "IncludeDecl", loc: loc(), path };
  }

// ---------------------------------------------------------------------------
// component
// ---------------------------------------------------------------------------

ComponentDecl
  = "component" __ name:Identifier __
    ext:ExtendsClause? __
    impl:ImplementsClause? __
    decos:Decorators __
    "{" __ body:ComponentBody __ "}" __ {
    return { type: "ComponentDecl", loc: loc(), name, extends: ext || null, implements: impl || [], decorators: decos, body };
  }

ComponentBody
  = items:(ComponentBodyItem __)* {
    return items.map(i => i[0]).filter(Boolean);
  }

ComponentBodyItem
  = DepDecl
  / SecretDecl
  / ElementDecl
  / EntityDecl
  / EnumDecl
  / FlowDecl
  / StateDecl
  / EventDecl
  / SignalDecl
  / ApiDecl
  / RuleDecl
  / ScreenDecl
  / JourneyDecl
  / OperationDecl
  / ActionDecl
  / SemanticComment
  / ComponentBodyError

ComponentBodyError
  = raw:$(!ComponentBodyKeyword !"}" [^\n\r]+ [\n\r]?) __ {
    return { type: "ErrorNode", loc: loc(), raw: raw.trim(), context: "component-body" };
  }

ComponentBodyKeyword
  = ("dep" / "secret" / "element" / "entity" / "enum" / "flow" / "state"
    / "event" / "signal" / "api" / "rule" / "screen" / "journey" / "operation" / "action" / "#") !IdentContinue

// ---------------------------------------------------------------------------
// dep
// ---------------------------------------------------------------------------

DepDecl
  = "dep" __ "->" __ target:Identifier __ decos:Decorators __ {
    return { type: "DepDecl", loc: loc(), target, decorators: decos };
  }

// ---------------------------------------------------------------------------
// secret
// ---------------------------------------------------------------------------

SecretDecl
  = "secret" __ name:IdentifierRaw __ decos:Decorators __ {
    return { type: "SecretDecl", loc: loc(), name, decorators: decos };
  }

// ---------------------------------------------------------------------------
// entity
// ---------------------------------------------------------------------------

EntityDecl
  = "entity" __ name:Identifier __
    ext:ExtendsClause? __
    impl:ImplementsClause? __
    decos:Decorators __
    "{" __ fields:FieldList __ "}" __ {
    return { type: "EntityDecl", loc: loc(), name, extends: ext || null, implements: impl || [], decorators: decos, fields };
  }

FieldList
  = items:(FieldListItem __)* {
    return items.map(i => i[0]).filter(i => i && i.type === "FieldDecl");
  }

FieldListItem
  = FieldDecl
  / SemanticComment

// Field: supports both "name: Type" (normative) and "name Type" (variant) syntax
FieldDecl
  = name:Identifier __ ":"? __ ft:TypeExpr __ decos:Decorators __ {
    return { type: "FieldDecl", loc: loc(), name, fieldType: ft, decorators: decos };
  }

// ---------------------------------------------------------------------------
// element
// ---------------------------------------------------------------------------

ElementDecl
  = "element" __ name:Identifier __
    ext:ExtendsClause? __
    impl:ImplementsClause? __
    decos:Decorators __
    "{" __ body:ElementBody __ "}" __ {
    return {
      type: "ElementDecl", loc: loc(), name,
      extends: ext || null,
      implements: impl || [],
      decorators: decos,
      body
    };
  }

ElementBody
  = items:(ElementBodyItem __)* {
    return items.map(i => i[0]).filter(Boolean);
  }

ElementBodyItem
  = PropDecl
  / FormDecl
  / SemanticComment

PropDecl
  = "prop" __ name:Identifier __ ":" __ pt:TypeExpr __ decos:Decorators __ {
    return { type: "PropDecl", loc: loc(), name, propType: pt, decorators: decos };
  }

// ---------------------------------------------------------------------------
// enum
// ---------------------------------------------------------------------------

EnumDecl
  = "enum" __ name:Identifier __ decos:Decorators __
    "{" __ values:EnumValues __ "}" __ {
    return { type: "EnumDecl", loc: loc(), name, decorators: decos, values };
  }

// Enum values separated by commas, semicolons, newlines, or any whitespace
EnumValues
  = first:EnumValueEntry rest:(__ [,;]? __ EnumValueEntry)* __ [,;]? {
    return [first, ...rest.map(r => r[3])];
  }

EnumValueEntry
  = name:Identifier {
    return { type: "EnumValue", loc: loc(), name };
  }

// ---------------------------------------------------------------------------
// flow
// ---------------------------------------------------------------------------

FlowDecl
  = "flow" __ name:Identifier __
    ext:ExtendsClause? __
    impl:ImplementsClause? __
    preDecos:Decorators __
    params:FlowParams? __
    ret:FlowReturn? __
    postDecos:Decorators __
    "{" __ body:FlowBody __ "}" __ {
    return {
      type: "FlowDecl", loc: loc(), name,
      extends: ext || null,
      implements: impl || [],
      params: params || [],
      returnType: ret || null,
      decorators: [...preDecos, ...postDecos],
      body
    };
  }

FlowParams
  = "(" __ ")" {
    return [];
  }
  / "(" __ types:TypeExprList __ ")" {
    return types;
  }

TypeExprList
  = first:TypeExpr rest:(__ "," __ TypeExpr)* {
    return [first, ...rest.map(r => r[3])];
  }

FlowReturn
  = "->" __ rt:UnionTypeExpr { return rt; }

FlowBody
  = items:(FlowBodyItem __)* {
    return items.map(i => i[0]).filter(Boolean);
  }

FlowBodyItem
  = OnClause
  / EmitsClause
  / OperationHandlesClause
  / FlowOverrideStep
  / FlowStep
  / SemanticComment

FlowOverrideStep
  = "override" !IdentContinue __ target:Identifier __ "->" __ action:FlowActionText args:FlowStepArgs? __ decos:Decorators __ {
    return {
      type: "FlowOverrideStep", loc: loc(),
      target: target,
      action: action.trim(),
      args: args || null,
      decorators: decos
    };
  }

FlowStep
  = arrow:("->" __)? action:FlowActionText args:FlowStepArgs? __ decos:Decorators
    branches:FlowBranches? {
    return {
      type: "FlowStep", loc: loc(),
      hasArrow: !!arrow,
      action: action.trim(),
      args: args || null,
      decorators: decos,
      branches: branches || []
    };
  }

FlowActionText
  = chars:FlowActionChar+ { return chars.join(""); }

FlowActionChar
  = !("->" / "@" / "{" / "}" / "|" / "#" / "(" / "\n" / "\r") c:. { return c; }

FlowStepArgs
  = "(" text:$[^)]* ")" { return text; }

FlowBranches
  = branches:(__ FlowBranch)+ {
    return branches.map(b => b[1]);
  }

FlowBranch
  = "|" __ condition:FlowBranchCond __ "->" __ action:RestOfLine {
    return { type: "FlowBranch", loc: loc(), condition: condition.trim(), action: action.trim() };
  }

FlowBranchCond
  = chars:$(!"->" [^\n\r])+ { return chars; }

RestOfLine
  = chars:$[^\n\r]* { return chars; }

// ---------------------------------------------------------------------------
// state
// ---------------------------------------------------------------------------

StateDecl
  = "state" __ name:Identifier __ sep:(":" / "on") __ enumRef:Identifier __
    decos:Decorators __
    "{" __ body:StateBody __ "}" __ {
    return {
      type: "StateDecl", loc: loc(), name, enumRef,
      decorators: decos,
      transitions: body.filter(i => i.type === "StateTransition"),
      comments: body.filter(i => i.type === "SemanticComment")
    };
  }

StateBody
  = items:(StateBodyItem __)* {
    return items.map(i => i[0]).filter(Boolean);
  }

StateBodyItem
  = StateTransition
  / SemanticComment

// Transition: "from -> to" optionally followed by ": on event" and decorators
StateTransition
  = from:StateRef __ "->" __ to:StateRef __
    event:TransitionEvent? __
    decos:Decorators __
    comment:InlineComment? __ {
    return {
      type: "StateTransition", loc: loc(),
      from, to,
      event: event || null,
      decorators: decos,
      trailingComment: comment || undefined
    };
  }

TransitionEvent
  = ":"? __ "on" __ name:Identifier { return name; }

StateRef
  = "*" { return "*"; }
  / Identifier

InlineComment
  = "#" text:$[^\n\r]* {
    return { type: "SemanticComment", loc: loc(), text: text.trim() };
  }

// ---------------------------------------------------------------------------
// event
// ---------------------------------------------------------------------------

EventDecl
  = "event" __ name:Identifier __
    ext:ExtendsClause? __
    decos:Decorators __
    "{" __ fields:FieldList __ "}" __ {
    return { type: "EventDecl", loc: loc(), name, extends: ext || null, decorators: decos, fields };
  }

// ---------------------------------------------------------------------------
// signal (client-side event)
// ---------------------------------------------------------------------------

SignalDecl
  = "signal" __ name:Identifier __
    ext:ExtendsClause? __
    decos:Decorators __
    "{" __ fields:FieldList __ "}" __ {
    return { type: "SignalDecl", loc: loc(), name, extends: ext || null, decorators: decos, fields };
  }

// ---------------------------------------------------------------------------
// api
// ---------------------------------------------------------------------------

ApiDecl
  = "api" __ apiName:ApiName? __ style:ApiStyle __ decos:Decorators __
    "{" __ body:ApiBody __ "}" __ {
    return {
      type: "ApiDecl", loc: loc(),
      name: apiName || null,
      style, decorators: decos,
      endpoints: body.filter(i => i.type === "ApiEndpointSimple" || i.type === "ApiEndpointExpanded"),
      comments: body.filter(i => i.type === "SemanticComment")
    };
  }

ApiName
  = name:Identifier &(__ ApiStyle) { return name; }

ApiStyle
  = "REST" / "GraphQL" / "gRPC"

ApiBody
  = items:(ApiBodyItem __)* {
    return items.map(i => i[0]).filter(Boolean);
  }

ApiBodyItem
  = ApiEndpointExpanded
  / ApiEndpointSimple
  / SemanticComment

// Expanded: METHOD /path\n  body: Type\n  response: Type\n  @decos
ApiEndpointExpanded
  = method:HttpMethod __ path:ApiPath __
    &(EndOfLine __ EndpointPropKey)
    props:EndpointProps __
    decos:Decorators __ {
    const body = props.find(p => p.key === "body");
    const response = props.find(p => p.key === "response");
    const query = props.find(p => p.key === "query");
    return {
      type: "ApiEndpointExpanded", loc: loc(),
      method, path,
      body: body ? body.value : null,
      response: response ? response.value : null,
      query: query ? query.value : null,
      decorators: decos
    };
  }

EndpointProps
  = props:(__ EndpointProp)+ {
    return props.map(p => p[1]);
  }

EndpointProp
  = key:EndpointPropKey __ ":" __ value:TypeExpr {
    return { key, value };
  }

EndpointPropKey
  = "body" / "response" / "query"

EndOfLine
  = [ \t]* [\n\r]

// Simple: METHOD /path (InputType) -> ReturnType @decos
ApiEndpointSimple
  = method:HttpMethod __ path:ApiPath __
    input:("(" __ TypeExpr __ ")")? __
    ret:("->" __ UnionTypeExpr)? __
    decos:Decorators __ {
    return {
      type: "ApiEndpointSimple", loc: loc(),
      method, path,
      inputType: input ? input[2] : null,
      returnType: ret ? ret[2] : null,
      decorators: decos
    };
  }

HttpMethod
  = "STREAM" / "GET" / "POST" / "PUT" / "DELETE" / "PATCH"

ApiPath
  = segments:ApiPathSegment+ { return segments.join(""); }

ApiPathSegment
  = "/" part:ApiPathPart { return "/" + part; }
  / "/" { return "/"; }

ApiPathPart
  = "{" name:Identifier "}" { return "{" + name + "}"; }
  / ":" name:Identifier { return ":" + name; }
  / chars:$[a-zA-Z0-9_\-]+ { return chars; }

// ---------------------------------------------------------------------------
// rule
// ---------------------------------------------------------------------------

RuleDecl
  = "rule" __ name:Identifier __ decos:Decorators __
    "{" __ body:RuleBody __ "}" __ {
    return { type: "RuleDecl", loc: loc(), name, decorators: decos, body };
  }

RuleBody
  = items:(RuleBodyItem __)* {
    return items.map(i => i[0]).filter(Boolean);
  }

RuleBodyItem
  = WhenClause
  / ElseIfClause
  / ElseClause
  / ThenClause
  / SemanticComment

WhenClause
  = "when" ":"? __ expr:RestOfLine __ {
    return { type: "WhenClause", loc: loc(), expression: expr.trim() };
  }

ThenClause
  = "then" ":"? __ action:RestOfLine __ {
    return { type: "ThenClause", loc: loc(), action: action.trim() };
  }

ElseIfClause
  = "elseif" ":"? __ condition:RestOfLine __ "then" ":"? __ action:RestOfLine __ {
    return { type: "ElseIfClause", loc: loc(), condition: condition.trim(), action: action.trim() };
  }

ElseClause
  = "else" ":"? __ action:RestOfLine __ {
    return { type: "ElseClause", loc: loc(), action: action.trim() };
  }

// ---------------------------------------------------------------------------
// screen
// ---------------------------------------------------------------------------

ScreenDecl
  = "screen" __ name:Identifier __
    ext:ExtendsClause? __
    impl:ImplementsClause? __
    decos:Decorators __
    "{" __ body:ScreenBody __ "}" __ {
    return { type: "ScreenDecl", loc: loc(), name, extends: ext || null, implements: impl || [], decorators: decos, body };
  }

ScreenBody
  = items:(ScreenBodyItem __)* {
    return items.map(i => i[0]).filter(Boolean);
  }

ScreenBodyItem
  = UsesDecl
  / FormDecl
  / SemanticComment

UsesDecl
  = "uses" __ element:Identifier __ "->" __ alias:Identifier __ decos:Decorators __ {
    return { type: "UsesDecl", loc: loc(), element, alias, decorators: decos };
  }

FormDecl
  = "form" __ name:Identifier? __ "{" __ fields:FieldList __ "}" __ {
    return { type: "FormDecl", loc: loc(), name: name || null, fields };
  }

ActionDecl
  = "action" __ name:Identifier __
    params:ActionParams? __
    decos:Decorators __
    "{" __ body:ActionBody __ "}" __ {
    return {
      type: "ActionDecl", loc: loc(), name,
      params: params || [], decorators: decos, body
    };
  }

ActionParams
  = "(" __ first:TypeExpr rest:(__ "," __ TypeExpr)* __ ")" {
    return [first, ...rest.map(r => r[3])];
  }

ActionBody
  = items:(ActionBodyItem __)* {
    return items.map(i => i[0]).filter(Boolean);
  }

ActionBodyItem
  = ActionFromClause
  / ActionOnStreamClause
  / ActionOnSignalClause
  / ActionCallsClause
  / ActionEmitsSignalClause
  / ActionResultEntry
  / SemanticComment

ActionFromClause
  = "from" __ screen:Identifier __ {
    return { type: "ActionFromClause", loc: loc(), screen };
  }

ActionOnStreamClause
  = "on" __ "STREAM" __ path:ApiPath __ {
    return { type: "ActionOnStreamClause", loc: loc(), path };
  }

ActionOnSignalClause
  = "on" __ name:Identifier __ {
    return { type: "ActionOnSignalClause", loc: loc(), signal: name };
  }

ActionCallsClause
  = "calls" __ method:HttpMethod __ path:ApiPath __ {
    return { type: "ActionCallsClause", loc: loc(), method, path };
  }

ActionEmitsSignalClause
  = "emits" __ name:Identifier __ {
    return { type: "ActionEmitsSignalClause", loc: loc(), signal: name };
  }

ActionResultEntry
  = "|" __ outcome:Identifier __ "->" __ screen:ScreenRef __ decos:Decorators __ {
    return { type: "ActionResult", loc: loc(), outcome, screen, decorators: decos };
  }

ScreenRef
  = "end" !IdentContinue { return "end"; }
  / Identifier

// ---------------------------------------------------------------------------
// journey
// ---------------------------------------------------------------------------

JourneyDecl
  = "journey" __ name:Identifier __ decos:Decorators __
    "{" __ body:JourneyBody __ "}" __ {
    return { type: "JourneyDecl", loc: loc(), name, decorators: decos, body };
  }

JourneyBody
  = items:(JourneyBodyItem __)* {
    return items.map(i => i[0]).filter(Boolean);
  }

JourneyBodyItem
  = JourneyStep
  / SemanticComment

JourneyStep
  = from:JourneyRef __ "->" __ to:JourneyRef __ ":"? __ "on" __ trigger:Identifier __
    decos:Decorators __ {
    return {
      type: "JourneyStep", loc: loc(),
      from, to, trigger,
      decorators: decos
    };
  }

JourneyRef
  = "*" { return "*"; }
  / "end" !IdentContinue { return "end"; }
  / Identifier

// ---------------------------------------------------------------------------
// operation
// ---------------------------------------------------------------------------

OperationDecl
  = "operation" __ name:Identifier __
    params:FlowParams? __
    ret:FlowReturn? __
    decos:Decorators __
    body:OperationBody? __ {
    return {
      type: "OperationDecl", loc: loc(), name,
      params: params || [],
      returnType: ret || null,
      decorators: decos,
      body: body || []
    };
  }

OperationBody
  = "{" __ items:(OperationBodyItem __)* __ "}" __ {
    return items.map(i => i[0]).filter(Boolean);
  }

OperationBodyItem
  = OperationHandlesClause
  / OperationCallsClause
  / EmitsClause
  / OnClause
  / EnforcesClause
  / SemanticComment

OperationHandlesClause
  = "handles" __ method:HttpMethod __ path:ApiPath __ {
    return { type: "OperationHandlesClause", loc: loc(), method, path };
  }

OperationCallsClause
  = "calls" __ method:HttpMethod __ path:ApiPath __ {
    return { type: "OperationCallsClause", loc: loc(), method, path };
  }

EmitsClause
  = "emits" __ name:Identifier __ {
    return { type: "EmitsClause", loc: loc(), event: name };
  }

OnClause
  = "on" __ name:Identifier __ {
    return { type: "OnClause", loc: loc(), event: name };
  }

EnforcesClause
  = "enforces" __ name:Identifier __ {
    return { type: "EnforcesClause", loc: loc(), rule: name };
  }

// ---------------------------------------------------------------------------
// Inheritance clauses
// ---------------------------------------------------------------------------

ExtendsClause
  = "extends" !IdentContinue __ name:Identifier { return name; }

ImplementsClause
  = "implements" !IdentContinue __ first:Identifier rest:(__ "," __ Identifier)* {
    return [first, ...rest.map(r => r[3])];
  }

// ---------------------------------------------------------------------------
// Type expressions
// ---------------------------------------------------------------------------

UnionTypeExpr
  = first:SingleTypeExpr rest:(__ "|" __ SingleTypeExpr)+ {
    const alts = [first, ...rest.map(r => r[3])];
    return { type: "UnionType", loc: loc(), alternatives: alts };
  }
  / SingleTypeExpr

SingleTypeExpr
  = base:BaseTypeExpr suffixes:TypeSuffix* {
    let result = base;
    for (const s of suffixes) {
      if (s === "?") {
        result = { type: "OptionalType", loc: loc(), inner: result };
      } else if (s === "[]") {
        result = { type: "ArrayType", loc: loc(), inner: result };
      }
    }
    return result;
  }

TypeSuffix
  = "?" { return "?"; }
  / "[]" { return "[]"; }

BaseTypeExpr
  = InlineObjectType
  / PrimitiveType
  / ReferenceType

PrimitiveType
  = name:("string" / "number" / "boolean" / "datetime" / "date" / "uuid" / "void")
    !IdentContinue {
    return { type: "PrimitiveType", loc: loc(), name };
  }

ReferenceType
  = name:Identifier {
    return { type: "ReferenceType", loc: loc(), name };
  }

InlineObjectType
  = "{" __ fields:InlineFieldList __ "}" {
    return { type: "InlineObjectType", loc: loc(), fields };
  }

InlineFieldList
  = first:FieldDecl rest:(__ ","? __ FieldDecl)* {
    return [first, ...rest.map(r => r[3])];
  }

TypeExpr
  = UnionTypeExpr

// ---------------------------------------------------------------------------
// Decorators
// ---------------------------------------------------------------------------

Decorators
  = decos:(Decorator __)* {
    return decos.map(d => d[0]);
  }

Decorator
  = "@" name:IdentifierRaw params:DecoratorParams? {
    return { type: "Decorator", loc: loc(), name, params: params || [] };
  }

DecoratorParams
  = "(" __ values:DecoratorValueList __ ")" { return values; }

DecoratorValueList
  = first:DecoratorValue rest:(__ "," __ DecoratorValue)* {
    return [first, ...rest.map(r => r[3])];
  }

DecoratorValue
  = RateValue
  / DurationValue
  / StringValue
  / NumberValue
  / PathValue
  / RelativePathValue
  / IdentifierValue

// e.g. 10/min, 200/min
RateValue
  = value:Number "/" unit:IdentifierRaw {
    return { kind: "rate", value, unit };
  }

// e.g. 30s, 5min, 1h, 7d
DurationValue
  = value:Number unit:("min" / "s" / "h" / "d") !IdentContinue {
    return { kind: "duration", value, unit };
  }

StringValue
  = str:StringLiteral { return { kind: "string", value: str }; }

NumberValue
  = value:Number !("/" / [a-zA-Z]) { return { kind: "number", value }; }

// e.g. /api/v1/auth, /tasks/{id}
PathValue
  = path:$("/" [a-zA-Z0-9_\-/{}.:]* ) {
    return { kind: "string", value: path };
  }

// Relative paths like src/models/user.ts, app/api/route.ts
RelativePathValue
  = first:IdentifierRaw "/" rest:$([a-zA-Z0-9_\-/{}.:]* ) {
    return { kind: "string", value: first + "/" + rest };
  }

// Decorator identifier values allow hyphens (e.g. e-commerce, in-progress)
IdentifierValue
  = first:IdentifierRaw rest:("-" IdentifierRaw)* {
    const name = first + rest.map(r => "-" + r[1]).join("");
    return { kind: "identifier", value: name };
  }

// ---------------------------------------------------------------------------
// Semantic comments (#)
// ---------------------------------------------------------------------------

SemanticComment
  = "#" text:$[^\n\r]* __ {
    return { type: "SemanticComment", loc: loc(), text: text.trim() };
  }

// ---------------------------------------------------------------------------
// Discardable comments (//)
// ---------------------------------------------------------------------------

LineComment
  = "//" [^\n\r]* { return null; }

// ---------------------------------------------------------------------------
// Terminals
// ---------------------------------------------------------------------------

Identifier
  = !ReservedWord name:IdentifierRaw { return name; }

IdentifierRaw
  = first:[a-zA-Z_] rest:IdentContinue* { return first + rest.join(""); }

IdentContinue
  = [a-zA-Z0-9_]

ReservedWord
  = ("system" / "component" / "element" / "entity" / "enum" / "flow" / "state"
    / "event" / "signal" / "api" / "rule" / "dep" / "secret" / "import" / "include"
    / "screen" / "journey" / "operation" / "form" / "action" / "end"
    / "when" / "then" / "emits" / "enforces" / "elseif" / "from" / "calls"
    / "handles" / "extends" / "implements" / "override" / "prop" / "uses"
    / "string" / "number" / "boolean" / "datetime" / "date" / "uuid" / "void")
    !IdentContinue

StringLiteral
  = '"' chars:$[^"]* '"' { return chars; }

Number
  = digits:$([0-9]+ ("." [0-9]+)?) { return parseFloat(digits); }

// Whitespace: spaces, tabs, newlines, discardable comments
__
  = ([ \t\n\r] / LineComment)*
