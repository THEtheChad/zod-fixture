import { AnyGenerator } from './any';
import { ArrayGenerator } from './array';
import { BigIntGenerator, BigIntMultipleOfGenerator } from './bigint';
import { BooleanGenerator } from './boolean';
import { BrandedGenerator } from './branded';
import { CatchGenerator } from './catch';
import { DateGenerator } from './date';
import { DefaultGenerator } from './default';
import {
	PreprocessGenerator,
	RefinementGenerator,
	TransformGenerator,
} from './effects';
import { EnumGenerator, NativeEnumGenerator } from './enum';
import { FunctionGenerator } from './function';
import { IntersectionGenerator } from './intersection';
import { LazyGenerator } from './lazy';
import { LiteralGenerator } from './literal';
import { MapGenerator } from './map';
import { NanGenerator } from './nan';
import { NeverGenerator } from './never';
import { NullGenerator } from './null';
import { NullableGenerator } from './nullable';
import { NumberGenerator } from './number';
import { ObjectGenerator, RecordGenerator } from './object';
import { OptionalGenerator } from './optional';
import { PipelineGenerator } from './pipeline';
import { PromiseGenerator } from './promise';
import { ReadonlyGenerator } from './readonly';
import { SetGenerator } from './set';
import {
	Base64Generator,
	Base64UrlGenerator,
	CidrGenerator,
	Cuid2Generator,
	CuidGenerator,
	DateStringGenerator,
	DateTimeGenerator,
	DurationGenerator,
	EmailGenerator,
	IpGenerator,
	JwtGenerator,
	NanoidGenerator,
	RegexGenerator,
	StringGenerator,
	TimeGenerator,
	UlidGenerator,
	UrlGenerator,
	UuidGenerator,
} from './string';
import { SymbolGenerator } from './symbol';
import { TupleGenerator } from './tuple';
import { UndefinedGenerator, VoidGenerator } from './undefined';
import { DiscriminatedUnionGenerator, UnionGenerator } from './union';
import { UnknownGenerator } from './unknown';

export const DEFAULT_FIXTURE_GENERATORS = [
	AnyGenerator,
	UnknownGenerator,
	OptionalGenerator,
	IpGenerator,
	UlidGenerator,
	ArrayGenerator,
	BigIntGenerator,
	BigIntMultipleOfGenerator,
	BooleanGenerator,
	DateGenerator,
	EnumGenerator,
	NativeEnumGenerator,
	FunctionGenerator,
	IntersectionGenerator,
	LiteralGenerator,
	MapGenerator,
	NanGenerator,
	NullGenerator,
	NumberGenerator,
	ObjectGenerator,
	RecordGenerator,
	SetGenerator,
	UuidGenerator,
	CuidGenerator,
	Cuid2Generator,
	EmailGenerator,
	UrlGenerator,
	DateTimeGenerator,
	DateStringGenerator,
	TimeGenerator,
	DurationGenerator,
	Base64Generator,
	Base64UrlGenerator,
	NanoidGenerator,
	JwtGenerator,
	CidrGenerator,
	RegexGenerator,
	NullableGenerator,
	TupleGenerator,
	UndefinedGenerator,
	UnionGenerator,
	DiscriminatedUnionGenerator,
	TransformGenerator,
	PreprocessGenerator,
	RefinementGenerator,
	PromiseGenerator,
	SymbolGenerator,
	LazyGenerator,
	BrandedGenerator,
	VoidGenerator,
	NeverGenerator,
	StringGenerator,
	DefaultGenerator,
	ReadonlyGenerator,
	PipelineGenerator,
	CatchGenerator,
];

export {
	AnyGenerator,
	ArrayGenerator,
	Base64Generator,
	Base64UrlGenerator,
	BigIntGenerator,
	BigIntMultipleOfGenerator,
	BooleanGenerator,
	BrandedGenerator,
	CatchGenerator,
	CidrGenerator,
	Cuid2Generator,
	CuidGenerator,
	DateGenerator,
	DateStringGenerator,
	DateTimeGenerator,
	DefaultGenerator,
	DiscriminatedUnionGenerator,
	DurationGenerator,
	EmailGenerator,
	EnumGenerator,
	FunctionGenerator,
	IntersectionGenerator,
	IpGenerator,
	JwtGenerator,
	LazyGenerator,
	LiteralGenerator,
	MapGenerator,
	NanGenerator,
	NanoidGenerator,
	NativeEnumGenerator,
	NeverGenerator,
	NullGenerator,
	NullableGenerator,
	NumberGenerator,
	ObjectGenerator,
	OptionalGenerator,
	PipelineGenerator,
	PreprocessGenerator,
	PromiseGenerator,
	ReadonlyGenerator,
	RecordGenerator,
	RefinementGenerator,
	RegexGenerator,
	SetGenerator,
	StringGenerator,
	SymbolGenerator,
	TimeGenerator,
	TransformGenerator,
	TupleGenerator,
	UlidGenerator,
	UndefinedGenerator,
	UnionGenerator,
	UnknownGenerator,
	UrlGenerator,
	UuidGenerator,
	VoidGenerator,
};
