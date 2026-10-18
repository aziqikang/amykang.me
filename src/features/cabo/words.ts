/**
 * Join codes. One word each, long enough to be unguessable in practice
 * for a casual card game, short enough to say across a room. Lowercase
 * a–z only, because they double as a URL path and a server room name.
 */
const WORDS = `
aardvark albatross alligator alpaca anteater antelope armadillo axolotl
badger barracuda beaver bison blowfish bumblebee butterfly buffalo
camel capybara caribou cassowary caterpillar chameleon cheetah chinchilla
chipmunk cockatoo condor cormorant coyote crocodile cuttlefish
dolphin dormouse dragonfly dromedary echidna eggplant elephant emu
falcon ferret firefly flamingo gazelle gecko gerbil gibbon giraffe
goldfinch gorilla grasshopper hamster hedgehog heron hippopotamus hummingbird
ibis iguana jackal jaguar jellyfish kangaroo kingfisher kiwi koala
ladybug lemur leopard lobster lynx macaw magpie manatee mandrill marmot
meerkat mongoose moose narwhal nightingale ocelot octopus opossum orangutan
ostrich otter pangolin panther parrot peacock pelican penguin platypus
porcupine puffin quail quokka raccoon reindeer rhinoceros salamander
seahorse starfish stingray tapir tortoise toucan walrus warthog weasel
wombat woodpecker yak zebra
apricot artichoke avocado blueberry cantaloupe clementine dumpling
gingerbread kumquat lemonade macaron marzipan nectarine persimmon
pistachio pomegranate pretzel rhubarb tangerine teapot waffle
`
  .trim()
  .split(/\s+/)

export function randomWord(): string {
  return WORDS[Math.floor(Math.random() * WORDS.length)]!
}

/** Normalises whatever was typed into the join box. */
export function cleanCode(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z]/g, '')
}
